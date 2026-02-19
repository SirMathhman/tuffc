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

		return Optional.of(stripped);
	}

	private static Path createPath(String extension) {
		return Paths.get(".", "src", extension, "com", "meti", "Main." + extension);
	}
}
