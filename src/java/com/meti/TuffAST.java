package com.meti;
import java.util.Optional;
import java.util.function.Function;
import java.util.List;
import java.util.ArrayList;
public class TuffAST {
	private static <T> Optional<List<T>> deserializeList(Optional<List<MapNode>> maybeNodes, Function<MapNode, Optional<T>> deserializer) {
		final var nodes = maybeNodes.orElse(new ArrayList<MapNode>());
		final var list = new ArrayList<T>();
		for (var child : nodes) {
			final var maybeItem = deserializer.apply(child);
			if (maybeItem.isEmpty()) return Optional.empty();
			list.add(maybeItem.get());
		}
		return Optional.of(list);
	}
}