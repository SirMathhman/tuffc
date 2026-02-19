package com.meti;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

public class Main {
	public static void main(String[] args) {
		try {
			final var input = Files.readString(createPath("java"));
			final var tuff = createPath("tuff");
			final var parent = tuff.getParent();
			if (!Files.exists(parent)) {
				Files.createDirectories(parent);
			}
			Files.writeString(tuff, input);
		} catch (IOException e) {
			//noinspection CallToPrintStackTrace
			e.printStackTrace();
		}
	}

	private static Path createPath(String extension) {
		return Paths.get(".", "src", extension, "com", "meti", "Main." + extension);
	}
}
