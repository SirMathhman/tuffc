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
import java.util.regex.Pattern;
import java.util.stream.Collectors;

public class Main {
	private static final class MapNode {
		private final Map<String, String> strings = new HashMap<String, String>();

		private MapNode withString(String key, String value) {
			this.strings.put(key, value);
			return this;
		}

		private Optional<String> findString(String key) {
			return Optional.ofNullable(this.strings.get(key));
		}
	}

	private static final Map<List<String>, List<String>> imports = new HashMap<List<String>, List<String>>();

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

		final var i = stripped.indexOf("class ");
		if (i >= 0) {
			final var afterKeyword = stripped.substring(i + "class ".length()).strip();
			final var i1 = afterKeyword.indexOf("{");
			if (i1 >= 0) {
				final var name = afterKeyword.substring(0, i1).strip();
				if (afterKeyword.endsWith("}")) {
					final var body = afterKeyword.substring(i1 + 1, afterKeyword.length() - 1);
					return generateObject(new MapNode().withString("name", name).withString("body", body));
				}
			}
		}

		return Optional.of(stripped);
	}

	private static Optional<String> generateObject(MapNode mapNode) {
		final var maybeName = mapNode.findString("name");
		final var maybeBody = mapNode.findString("body");
		return maybeName.flatMap(name -> {
			return maybeBody.flatMap(body -> {
				return Optional.of("out object " + name + " {" + body + "}");
			});
		});
	}

	private static Path createPath(String extension) {
		return Paths.get(".", "src", extension, "com", "meti", "Main." + extension);
	}
}
