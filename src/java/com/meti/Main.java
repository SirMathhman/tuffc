package com.meti;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.BiFunction;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

public class Main {
	private interface Rule {

		Optional<MapNode> lex(String value);

		Optional<String> generate(MapNode node);
	}

	private static final class MapNode {
		private final Map<String, String> strings = new HashMap<String, String>();
		private final Map<String, List<MapNode>> nodeLists = new HashMap<String, List<MapNode>>();

		private MapNode withString(String key, String value) {
			this.strings.put(key, value);
			return this;
		}

		private Optional<String> findString(String key) {
			return Optional.ofNullable(this.strings.get(key));
		}

		public MapNode merge(MapNode other) {
			this.strings.putAll(other.strings);
			return this;
		}

		public MapNode withNodeList(String key, ArrayList<MapNode> nodes) {
			this.nodeLists.put(key, nodes);
			return this;
		}

		public Optional<List<MapNode>> findNodeList(String key) {
			return Optional.ofNullable(this.nodeLists.get(key));
		}
	}

	private record StringRule(String key) implements Rule {
		@Override
		public Optional<MapNode> lex(String value) {
			return Optional.of(new MapNode().withString(this.key(), value));
		}

		@Override
		public Optional<String> generate(MapNode node) {
			return node.findString(this.key);
		}
	}

	private record SuffixRule(Rule childRule, String suffix) implements Rule {
		@Override
		public Optional<MapNode> lex(String slice) {
			if (!slice.endsWith(this.suffix())) {return Optional.empty();}
			final var body = slice.substring(0, slice.length() - this.suffix().length());
			return this.childRule().lex(body);
		}

		@Override
		public Optional<String> generate(MapNode node) {
			return this.childRule.generate(node).map(slice -> slice + this.suffix());
		}
	}

	private record StripRule(Rule childRule) implements Rule {
		@Override
		public Optional<MapNode> lex(String substring) {
			return this.childRule().lex(substring.strip());
		}

		@Override
		public Optional<String> generate(MapNode node) {
			return this.childRule.generate(node);
		}
	}

	private record InfixRule(Rule leftRule, String infix, Rule rightRule) implements Rule {
		@Override
		public Optional<MapNode> lex(String input) {
			final var i1 = input.indexOf(this.infix());
			if (i1 < 0) {return Optional.empty();}
			final var substring = input.substring(0, i1);
			final var afterName = input.substring(i1 + this.infix().length());
			return this.leftRule().lex(substring).flatMap(inner -> this.rightRule().lex(afterName).map(inner::merge));
		}

		@Override
		public Optional<String> generate(MapNode node) {
			return this.leftRule.generate(node).flatMap(leftResult -> {
				return this.rightRule.generate(node).map(rightResult -> {
					return leftResult + this.infix + rightResult;
				});
			});
		}
	}

	private record PrefixRule(String prefix, InfixRule rule) implements Rule {
		@Override
		public Optional<MapNode> lex(String value) {
			if (value.startsWith(this.prefix)) {
				return this.rule.lex(value.substring(this.prefix.length()));
			}
			return Optional.empty();
		}

		@Override
		public Optional<String> generate(MapNode node) {
			return this.rule.generate(node).map(slice -> this.prefix + slice);
		}
	}

	private record NodeListRule(String key, Rule rule) implements Rule {
		private static ArrayList<String> split(String input) {
			final var segments = new ArrayList<String>();
			var buffer = new StringBuilder();
			var depth = 0;
			for (var i = 0; i < input.length(); i++) {
				final var c = input.charAt(i);
				buffer.append(c);
				if (c == ';' && depth == 0) {
					segments.add(buffer.toString());
					buffer = new StringBuilder();
				} else {
					if (c == '{') {
						depth++;
					}
					if (c == '}') {
						depth--;
					}
				}
			}
			if (!buffer.isEmpty()) {
				segments.add(buffer.toString());
			}
			return segments;
		}

		@Override
		public Optional<MapNode> lex(String value) {
			return split(value)
					.stream()
					.map(this.rule::lex)
					.reduce(Optional.of(new ArrayList<MapNode>()), optionally(Main::add), (_, next) -> next)
					.map(segments -> {
						return new MapNode().withNodeList(this.key, segments);
					});
		}

		@Override
		public Optional<String> generate(MapNode node) {
			return node
					.findNodeList(this.key)
					.flatMap(list -> list
							.stream()
							.map(this.rule::generate)
							.reduce(Optional.of(""), optionally((s, s2) -> s + s2), (_, next) -> next));
		}
	}

	private record OrRule(List<Rule> rules) implements Rule {
		public static Rule from(Rule... rules) {
			return new OrRule(Arrays.asList(rules));
		}

		@Override
		public Optional<MapNode> lex(String value) {
			for (var rule : this.rules) {
				final var lex = rule.lex(value);
				if (lex.isPresent()) {
					return lex;
				}
			}

			return Optional.empty();
		}

		@Override
		public Optional<String> generate(MapNode node) {
			for (var rule : this.rules) {
				final var generate = rule.generate(node);
				if (generate.isPresent()) {
					return generate;
				}
			}

			return Optional.empty();
		}
	}

	private static final Map<List<String>, List<String>> imports = new HashMap<List<String>, List<String>>();

	private static <C, T> BiFunction<Optional<C>, Optional<T>, Optional<C>> optionally(BiFunction<C, T, C> mapper) {
		return (mapNodes, mapNode) -> mapNodes.flatMap(list -> mapNode.map(inner -> mapper.apply(list, inner)));
	}

	private static ArrayList<MapNode> add(ArrayList<MapNode> list, MapNode inner) {
		list.add(inner);
		return list;
	}

	public static void main(String[] args) {
		try {
			final var input = Files.readString(createPath("java"));
			final var tuff = createPath("tuff");
			final var parent = tuff.getParent();
			if (!Files.exists(parent)) {
				Files.createDirectories(parent);
			}
			Files.writeString(tuff, compile(input));
		} catch (IOException e) {
			//noinspection CallToPrintStackTrace
			e.printStackTrace();
		}
	}

	private static String compile(String input) {
		final var segments = NodeListRule.split(input);
		final var joinedRoot = segments.stream().map(Main::compileRootSegment).flatMap(Optional::stream).toList();
		final var newImports = imports.entrySet().stream().map(entry -> {
			final var key = entry.getKey();
			final var values = entry.getValue();
			return "extern let { " + String.join(", ", values) + " } = " + String.join("::", key) + ";";
		}).toList();

		final var outputSegments = new ArrayList<String>(newImports);
		outputSegments.addAll(joinedRoot);
		outputSegments.add("Main::main(__args__)");
		return outputSegments.stream().map(slice -> slice + System.lineSeparator()).collect(Collectors.joining());
	}

	private static Optional<String> compileRootSegment(String input) {
		final var stripped = input.strip();
		if (stripped.isEmpty() || stripped.startsWith("package ")) {
			return Optional.empty();
		}

		if (stripped.startsWith("import ") && stripped.endsWith(";")) {
			final var i = stripped.lastIndexOf(".");
			if (i >= 0) {
				final var substring = stripped.substring("import ".length(), i);
				final var leaf = stripped.substring(i + 1, stripped.length() - 1);
				final var split = substring.split(Pattern.quote("."));
				final var namespace = Arrays.asList(split);
				if (!imports.containsKey(namespace)) {
					imports.put(namespace, new ArrayList<String>());
				}

				imports.get(namespace).add(leaf);
				return Optional.empty();
			}
		}

		return compileClass(stripped).or(() -> Optional.of(stripped));
	}

	private static Optional<String> compileClass(String stripped) {
		return createClassRule().lex(stripped).flatMap(mapNode -> createObjectRule().generate(mapNode));
	}

	private static InfixRule createClassRule() {
		final var modifiers = new StringRule("modifiers");
		final var name = new StripRule(new StringRule("name"));
		final var body = new NodeListRule("body", OrRule.from(new StringRule("?")));

		return new InfixRule(modifiers, "class ", new InfixRule(name, "{", new SuffixRule(body, "}")));
	}

	private static PrefixRule createObjectRule() {
		return new PrefixRule("out object ",
													new InfixRule(new StringRule("name"), " {", new SuffixRule(new StringRule("body"), "}")));
	}

	private static Path createPath(String extension) {
		return Paths.get(".", "src", extension, "com", "meti", "Main." + extension);
	}
}
