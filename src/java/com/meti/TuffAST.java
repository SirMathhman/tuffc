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
	public sealed interface RootChild permits Object, Contract {
		static Optional<RootChild> deserialize(MapNode node) {
			return Object.deserialize(node).map(value -> (RootChild) value)
				.or(() -> Contract.deserialize(node).map(value -> (RootChild) value));
		}

		MapNode serialize();
	}
	public record Object(String name) implements RootChild {
		public static Optional<Object> deserialize(MapNode node){
			if (!node.is("object")) return Optional.empty();
			final var maybeName = node.findString("name");
			if (maybeName.isEmpty()) return Optional.empty();
			return Optional.of(new Object(maybeName.get()));
		}
		public MapNode serialize() {
			return new MapNode("object")
				.withString("name", this.name());
		}
	}
	public record Contract(String name) implements RootChild {
		public static Optional<Contract> deserialize(MapNode node){
			if (!node.is("contract")) return Optional.empty();
			final var maybeName = node.findString("name");
			if (maybeName.isEmpty()) return Optional.empty();
			return Optional.of(new Contract(maybeName.get()));
		}
		public MapNode serialize() {
			return new MapNode("contract")
				.withString("name", this.name());
		}
	}
	public record Root(List<RootChild> children) {
		public static Optional<Root> deserialize(MapNode node){
			if (!node.is("root")) return Optional.empty();
			final var maybeChildren = deserializeList(node.findNodeList("children"), RootChild::deserialize);
			if (maybeChildren.isEmpty()) return Optional.empty();
			return Optional.of(new Root(maybeChildren.get()));
		}
		public MapNode serialize() {
			return new MapNode("root")
				.withNodeList("children", this.children.stream().map(RootChild::serialize).toList());
		}
	}
}