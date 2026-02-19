package com.meti;

import java.io.IOException;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.BiFunction;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

public class Main {
	private sealed interface Result<T, X> permits Err, Ok {
		<R> Result<R, X> mapValue(Function<T, R> mapper);

		<R> Result<R, X> flatMap(Function<T, Result<R, X>> mapper);

		<R> R match(Function<T, R> whenOk, Function<X, R> whenErr);

		<R> Result<Tuple<T, R>, X> and(Supplier<Result<R, X>> mapper);

		<R> Result<T, R> mapErr(Function<X, R> mapper);

		Optional<T> findValue();
	}

	private interface Rule {
		Result<MapNode, CompileError> lex(String value);

		Result<String, CompileError> generate(MapNode node);
	}

	private sealed interface Context permits NodeContext, StringContext {
		String display();
	}

	private interface Error {
		String display();
	}

	private record CompileError(String message, Context context, List<CompileError> children) implements Error {
		public CompileError(String message, Context context) {
			this(message, context, new ArrayList<CompileError>());
		}

		@Override
		public String display() {
			final var joined = this.children.stream().map(CompileError::display).collect(Collectors.joining());
			return this.message + ": " + this.context.display() + joined;
		}
	}

	private static final class MapNode {
		private final Map<String, String> strings = new HashMap<String, String>();
		private final Map<String, List<MapNode>> nodeLists = new HashMap<String, List<MapNode>>();
		private Optional<String> maybeType = Optional.empty();

		private MapNode withString(String key, String value) {
			this.strings.put(key, value);
			return this;
		}

		private Optional<String> findString(String key) {
			return Optional.ofNullable(this.strings.get(key));
		}

		public MapNode merge(MapNode other) {
			this.strings.putAll(other.strings);
			this.nodeLists.putAll(other.nodeLists);
			return this;
		}

		public MapNode withNodeList(String key, List<MapNode> nodes) {
			this.nodeLists.put(key, nodes);
			return this;
		}

		public Optional<List<MapNode>> findNodeList(String key) {
			return Optional.ofNullable(this.nodeLists.get(key));
		}

		public boolean is(String type) {
			return this.maybeType.isPresent() && this.maybeType.get().equals(type);
		}

		public MapNode retype(String type) {
			this.maybeType = Optional.of(type);
			return this;
		}

		public String display() {
			/*
			TODO: something better
			*/
			return this.toString();
		}
	}

	private record Tuple<A, B>(A left, B right) {}

	private record Ok<T, X>(T value) implements Result<T, X> {
		@Override
		public <R> Result<R, X> mapValue(Function<T, R> mapper) {
			return new Ok<R, X>(mapper.apply(this.value));
		}

		@Override
		public <R> Result<R, X> flatMap(Function<T, Result<R, X>> mapper) {
			return mapper.apply(this.value);
		}

		@Override
		public <R> R match(Function<T, R> whenOk, Function<X, R> whenErr) {
			return whenOk.apply(this.value);

		}

		@Override
		public <R> Result<Tuple<T, R>, X> and(Supplier<Result<R, X>> supplier) {
			return supplier.get().mapValue(otherValue -> new Tuple<T, R>(this.value, otherValue));
		}

		@Override
		public <R> Result<T, R> mapErr(Function<X, R> mapper) {
			return new Ok<T, R>(this.value);
		}

		@Override
		public Optional<T> findValue() {
			return Optional.of(this.value);
		}
	}

	private record Err<T, X>(X error) implements Result<T, X> {
		@Override
		public <R> Result<R, X> mapValue(Function<T, R> mapper) {
			return new Err<R, X>(this.error);
		}

		@Override
		public <R> Result<R, X> flatMap(Function<T, Result<R, X>> mapper) {
			return new Err<R, X>(this.error);
		}

		@Override
		public <R> R match(Function<T, R> whenOk, Function<X, R> whenErr) {
			return whenErr.apply(this.error);
		}

		@Override
		public <R> Result<Tuple<T, R>, X> and(Supplier<Result<R, X>> mapper) {
			return new Err<Tuple<T, R>, X>(this.error);
		}

		@Override
		public <R> Result<T, R> mapErr(Function<X, R> mapper) {
			return new Err<T, R>(mapper.apply(this.error));
		}

		@Override
		public Optional<T> findValue() {
			return Optional.empty();
		}
	}

	private record NodeContext(MapNode node) implements Context {
		@Override
		public String display() {
			return this.node.display();
		}
	}

	private record StringRule(String key) implements Rule {
		@Override
		public Result<MapNode, CompileError> lex(String value) {
			return new Ok<MapNode, CompileError>(new MapNode().withString(this.key(), value));
		}

		@Override
		public Result<String, CompileError> generate(MapNode node) {
			return node.findString(this.key).<Result<String, CompileError>>map(Ok::new).orElseGet(() -> {
				final var error = new CompileError("Key '" + this.key + "' not found", new NodeContext(node));
				return new Err<String, CompileError>(error);
			});
		}
	}

	private record SuffixRule(Rule childRule, String suffix) implements Rule {
		@Override
		public Result<MapNode, CompileError> lex(String slice) {
			if (!slice.endsWith(this.suffix())) {
				final var error = new CompileError("Suffix '" + this.suffix + "' not present", new StringContext(slice));

				return new Err<MapNode, CompileError>(error);
			}
			final var body = slice.substring(0, slice.length() - this.suffix().length());
			return this.childRule().lex(body);
		}

		@Override
		public Result<String, CompileError> generate(MapNode node) {
			return this.childRule.generate(node).mapValue(slice -> slice + this.suffix());
		}
	}

	private record StripRule(Rule childRule) implements Rule {
		@Override
		public Result<MapNode, CompileError> lex(String substring) {
			return this.childRule().lex(substring.strip());
		}

		@Override
		public Result<String, CompileError> generate(MapNode node) {
			return this.childRule.generate(node);
		}
	}

	private record InfixRule(Rule leftRule, String infix, Rule rightRule) implements Rule {
		@Override
		public Result<MapNode, CompileError> lex(String input) {
			final var i1 = input.indexOf(this.infix());
			if (i1 < 0) {
				final var error = new CompileError("Infix '" + this.infix + "' not present", new StringContext(input));

				return new Err<MapNode, CompileError>(error);
			}

			final var substring = input.substring(0, i1);
			final var afterName = input.substring(i1 + this.infix().length());
			return this.leftRule().lex(substring).flatMap(inner -> this.rightRule().lex(afterName).mapValue(inner::merge));
		}

		@Override
		public Result<String, CompileError> generate(MapNode node) {
			return this.leftRule.generate(node).flatMap(leftResult -> {
				return this.rightRule.generate(node).mapValue(rightResult -> {
					return leftResult + this.infix + rightResult;
				});
			});
		}
	}

	private record PrefixRule(String prefix, InfixRule rule) implements Rule {
		@Override
		public Result<MapNode, CompileError> lex(String value) {
			if (value.startsWith(this.prefix)) {
				return this.rule.lex(value.substring(this.prefix.length()));
			}
			return new Err<MapNode, CompileError>(new CompileError("Prefix '" + this.prefix + "' not present",
																														 new StringContext(value)));
		}

		@Override
		public Result<String, CompileError> generate(MapNode node) {
			return this.rule.generate(node).mapValue(slice -> this.prefix + slice);
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
					continue;
				}
				if (c == '}' && depth == 1) {
					depth--;
					segments.add(buffer.toString());
					buffer = new StringBuilder();
					continue;
				}
				if (c == '{') {
					depth++;
				}
				if (c == '}') {
					depth--;
				}
			}
			if (!buffer.isEmpty()) {
				segments.add(buffer.toString());
			}
			return segments;
		}

		@Override
		public Result<MapNode, CompileError> lex(String value) {
			return split(value)
					.stream()
					.<Result<List<MapNode>, CompileError>>reduce(new Ok<List<MapNode>, CompileError>(new ArrayList<MapNode>()),
																											 (listCompileErrorResult, segment) -> listCompileErrorResult
																													 .and(() -> this.rule.lex(segment))
																													 .mapValue(Main::getMapNodes),
																											 (_, next) -> next)
					.mapValue(segments -> new MapNode().withNodeList(this.key, segments));
		}

		@Override
		public Result<String, CompileError> generate(MapNode node) {
			return node.findNodeList(this.key).map(this::reduceChildren).orElseGet(() -> {
				final var error = new CompileError("Key '" + this.key + "' not present", new NodeContext(node));
				return new Err<String, CompileError>(error);
			});
		}

		private Result<String, CompileError> reduceChildren(List<MapNode> list) {
			return list
					.stream()
					.map(this.rule::generate)
					.reduce(new Ok<String, CompileError>(""), optionally((s, s2) -> s + s2), (_, next) -> next);
		}
	}

	private record OrRule(List<Rule> rules) implements Rule {
		public static Rule from(Rule... rules) {
			return new OrRule(Arrays.asList(rules));
		}

		@Override
		public Result<MapNode, CompileError> lex(String value) {
			return this.rules
					.stream()
					.reduce(new Accumulator<MapNode>(),
									(accumulator, rule) -> rule.lex(value).match(accumulator::withValue, accumulator::withError),
									(_, next) -> next)
					.toResult()
					.mapErr(children -> new CompileError("No rule matched", new StringContext(value), children));
		}

		@Override
		public Result<String, CompileError> generate(MapNode node) {
			return this.rules
					.stream()
					.reduce(new Accumulator<String>(),
									(accumulator, rule) -> rule.generate(node).match(accumulator::withValue, accumulator::withError),
									(_, next) -> next)
					.toResult()
					.mapErr(children -> new CompileError("No rule matched", new NodeContext(node), children));
		}
	}

	private static class PlaceholderRule implements Rule {
		@Override
		public Result<MapNode, CompileError> lex(String value) {
			return new Ok<MapNode, CompileError>(new MapNode().withString("content", value));
		}

		@Override
		public Result<String, CompileError> generate(MapNode node) {
			final var content = node.findString("content").orElse("???");
			return new Ok<String, CompileError>("/*" + content + "*/");
		}
	}

	private static class LazyRule implements Rule {
		private Optional<Rule> maybeRule = Optional.empty();

		public void set(Rule other) {
			this.maybeRule = Optional.of(other);
		}

		@Override
		public Result<MapNode, CompileError> lex(String value) {
			return this.maybeRule
					.map(rule -> rule.lex(value))
					.orElseGet(() -> new Err<MapNode, CompileError>(new CompileError("Rule not set", new StringContext(value))));
		}

		@Override
		public Result<String, CompileError> generate(MapNode node) {
			return this.maybeRule
					.map(rule -> rule.generate(node))
					.orElseGet(() -> new Err<String, CompileError>(new CompileError("Rule not set", new NodeContext(node))));
		}
	}

	private record TypeRule(String type, Rule rule) implements Rule {
		@Override
		public Result<MapNode, CompileError> lex(String value) {
			return this.rule.lex(value).mapValue(node -> node.retype(this.type));
		}

		@Override
		public Result<String, CompileError> generate(MapNode node) {
			if (node.is(this.type)) {
				return this.rule.generate(node);
			}

			return new Err<String, CompileError>(new CompileError("Type '" + this.type + "' not present",
																														new NodeContext(node)));
		}
	}

	private record StringContext(String input) implements Context {
		@Override
		public String display() {
			return this.input;
		}
	}

	private record Accumulator<T>(Optional<T> maybeValue, List<CompileError> errors) {
		public Accumulator() {
			this(Optional.empty(), Collections.emptyList());
		}

		private Accumulator<T> withValue(T t) {
			return new Accumulator<T>(Optional.of(t), this.errors);
		}

		private Accumulator<T> withError(CompileError error) {
			final var copy = new ArrayList<CompileError>(this.errors);
			copy.add(error);
			return new Accumulator<T>(this.maybeValue, copy);
		}

		public Result<T, List<CompileError>> toResult() {
			return this.maybeValue
					.<Result<T, List<CompileError>>>map(Ok::new)
					.orElseGet(() -> new Err<T, List<CompileError>>(this.errors));
		}
	}

	private record JavaError(Exception e) implements Error {
		@Override
		public String display() {
			final var writer = new StringWriter();
			this.e.printStackTrace(new PrintWriter(writer));
			return writer.toString();
		}
	}

	private static final Map<List<String>, List<String>> imports = new HashMap<List<String>, List<String>>();

	private static List<MapNode> getMapNodes(Tuple<List<MapNode>, MapNode> tuple) {
		final var left = tuple.left;
		left.add(tuple.right);
		return left;
	}

	private static <C, T> BiFunction<Result<C, CompileError>, Result<T, CompileError>, Result<C, CompileError>> optionally(
			BiFunction<C, T, C> mapper) {
		return (mapNodes, mapNode) -> mapNodes.flatMap(list -> mapNode.mapValue(inner -> mapper.apply(list, inner)));
	}

	public static void main(String[] args) {
		run().ifPresent(error -> System.out.println(error.display()));
	}

	private static Optional<Error> run() {
		final var javaSource = createPath("java");
		final var tuffSource = createPath("tuff");

		return switch (readString(javaSource)) {
			case Err<String, Error> v -> Optional.of(v.error);
			case Ok<String, Error> ok -> {
				final var parent = tuffSource.getParent();
				if (!Files.exists(parent)) {
					yield createDirectories(parent).map(JavaError::new);
				}

				yield switch (compile(ok.value)) {
					case Err<String, CompileError> v -> Optional.of(v.error);
					case Ok<String, CompileError> v -> writeString(tuffSource, v.value);
				};
			}
		};
	}

	private static Optional<Error> writeString(Path target, String output) {
		try {
			Files.writeString(target, output);
			return Optional.empty();
		} catch (IOException e) {
			return Optional.of(new JavaError(e));
		}
	}

	private static Optional<IOException> createDirectories(Path parent) {
		try {
			Files.createDirectories(parent);
			return Optional.empty();
		} catch (IOException e) {
			return Optional.of(e);
		}
	}

	private static Result<String, Error> readString(Path path) {
		try {
			return new Ok<String, Error>(Files.readString(path));
		} catch (IOException e) {
			return new Err<String, Error>(new JavaError(e));
		}
	}

	private static Result<String, CompileError> compile(String input) {
		final var segments = NodeListRule.split(input);

		final var joinedRoot = new ArrayList<String>();
		for (var segment : segments) {
			final var result = compileRootSegment(segment);
			switch (result) {
				case Err<String, CompileError> v -> {
					return new Err<String, CompileError>(v.error);
				}
				case Ok<String, CompileError> v -> {
					joinedRoot.add(v.value);
				}
			}
		}

		final var newImports = imports.entrySet().stream().map(entry -> {
			final var key = entry.getKey();
			final var values = entry.getValue();
			return "extern let { " + String.join(", ", values) + " } = " + String.join("::", key) + ";";
		}).toList();

		final var outputSegments = new ArrayList<String>(newImports);
		outputSegments.addAll(joinedRoot);
		outputSegments.add("Main::main(__args__)");
		return new Ok<String, CompileError>(outputSegments
																						.stream()
																						.map(slice -> slice + System.lineSeparator())
																						.collect(Collectors.joining()));
	}

	private static Result<String, CompileError> compileRootSegment(String input) {
		final var stripped = input.strip();
		if (stripped.isEmpty() || stripped.startsWith("package ")) {
			return new Ok<String, CompileError>("");
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
				return new Ok<String, CompileError>("");
			}
		}

		return compileClass(stripped);
	}

	private static Result<String, CompileError> compileClass(String stripped) {
		final var classSegmentRule = new LazyRule();
		classSegmentRule.set(createClassSegmentRule(classSegmentRule));

		final var moduleMemberRule = new LazyRule();
		moduleMemberRule.set(OrRule.from(createObjectRule(moduleMemberRule), new PlaceholderRule()));

		return createClassRule(classSegmentRule)
				.lex(stripped)
				.mapValue(Main::transformRootSegment)
				.flatMap(moduleMemberRule::generate);
	}

	private static MapNode transformRootSegment(MapNode node) {
		if (node.is("class")) {
			return node.retype("object");
		}

		if (node.is("interface")) {
			return node.retype("contact");
		}

		return node;
	}

	private static Rule createClassRule(Rule classSegmentRule) {
		return createStructureRule("class", classSegmentRule);
	}

	private static Rule createStructureRule(String type, Rule classSegmentRule) {
		final var modifiers = new StringRule("modifiers");
		final var name = new StripRule(new StringRule("name"));
		final var body = new NodeListRule("body", classSegmentRule);
		final var rightRule = new InfixRule(name, "{", new SuffixRule(new StripRule(body), "}"));
		return new TypeRule(type, new InfixRule(modifiers, type + " ", rightRule));
	}

	private static Rule createClassSegmentRule(Rule classMemberRule) {
		return OrRule.from(createStructureRule("interface", classMemberRule),
											 createClassRule(classMemberRule),
											 new PlaceholderRule());
	}

	private static Rule createObjectRule(LazyRule moduleMemberRule) {
		final var name = new StringRule("name");
		final var body = new NodeListRule("body", moduleMemberRule);
		return new TypeRule("object", new PrefixRule("out object ", new InfixRule(name, " {", new SuffixRule(body, "}"))));
	}

	private static Path createPath(String extension) {
		return Paths.get(".", "src", extension, "com", "meti", "Main." + extension);
	}
}
