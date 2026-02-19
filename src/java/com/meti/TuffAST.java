package com.meti;
import java.util.Optional;
import java.util.function.Function;
import java.util.List;
import java.util.ArrayList;
public class TuffAST {
	private static <T> Result<List<T>, String> deserializeList(Optional<List<MapNode>> maybeNodes, Function<MapNode, Result<T, String>> deserializer, String ownerType, String key) {
		final var nodes = maybeNodes.orElse(new ArrayList<MapNode>());
		final var list = new ArrayList<T>();
		for (var i = 0; i < nodes.size(); i++) {
			final var index = i;
			final var itemResult = deserializer.apply(nodes.get(i));
			final var maybeError = itemResult.match(
					value -> { list.add(value); return Optional.<String>empty(); },
					error -> Optional.of("Failed to deserialize list field '" + key + "' on '" + ownerType + "' at index " + index + ": " + error));
			if (maybeError.isPresent()) return new Err<List<T>, String>(maybeError.get());
		}
		return new Ok<List<T>, String>(list);
	}
	private static <T> Result<List<MapNode>, String> serializeList(List<T> list, Function<T, Result<MapNode, String>> serializer, String ownerType, String key) {
		final var nodes = new ArrayList<MapNode>();
		for (var i = 0; i < list.size(); i++) {
			final var index = i;
			final var itemResult = serializer.apply(list.get(i));
			final var maybeError = itemResult.match(
					value -> { nodes.add(value); return Optional.<String>empty(); },
					error -> Optional.of("Failed to serialize list field '" + key + "' on '" + ownerType + "' at index " + index + ": " + error));
			if (maybeError.isPresent()) return new Err<List<MapNode>, String>(maybeError.get());
		}
		return new Ok<List<MapNode>, String>(nodes);
	}
	public sealed interface RootChild permits Object, Contract {
		static Result<RootChild, String> deserialize(MapNode node) {
			return Object.deserialize(node).mapValue(value -> (RootChild) value)
				.or(() -> Contract.deserialize(node).mapValue(value -> (RootChild) value));
		}

		Result<MapNode, String> serialize();
	}
	public record Object(String name) implements RootChild {
		public static Result<Object, String> deserialize(MapNode node){
			if (!node.is("object")) return new Err<Object, String>("Expected type 'object'");
			final var maybeName = node.findString("name").<Result<String, String>>map(Ok::new).orElseGet(() -> new Err<String, String>("Missing string field 'name' for type 'Object'"));
			if (maybeName instanceof Err<?, String>(var error)) return new Err<Object, String>(error);
			return new Ok<Object, String>(new Object(maybeName.match(value -> value, error -> null)));
		}
		@Override
		public Result<MapNode, String> serialize() {
			return new Ok<MapNode, String>(new MapNode("object"))
				.mapValue(resultNode -> resultNode.withString("name", this.name()));
		}
	}
	public record Contract(String name) implements RootChild {
		public static Result<Contract, String> deserialize(MapNode node){
			if (!node.is("contract")) return new Err<Contract, String>("Expected type 'contract'");
			final var maybeName = node.findString("name").<Result<String, String>>map(Ok::new).orElseGet(() -> new Err<String, String>("Missing string field 'name' for type 'Contract'"));
			if (maybeName instanceof Err<?, String>(var error)) return new Err<Contract, String>(error);
			return new Ok<Contract, String>(new Contract(maybeName.match(value -> value, error -> null)));
		}
		@Override
		public Result<MapNode, String> serialize() {
			return new Ok<MapNode, String>(new MapNode("contract"))
				.mapValue(resultNode -> resultNode.withString("name", this.name()));
		}
	}
	public record Root(List<RootChild> children) {
		public static Result<Root, String> deserialize(MapNode node){
			if (!node.is("root")) return new Err<Root, String>("Expected type 'root'");
			final var maybeChildren = deserializeList(node.findNodeList("children"), RootChild::deserialize, "Root", "children");
			if (maybeChildren instanceof Err<?, String>(var error)) return new Err<Root, String>(error);
			return new Ok<Root, String>(new Root(maybeChildren.match(value -> value, error -> null)));
		}
		@Override
		public Result<MapNode, String> serialize() {
			return new Ok<MapNode, String>(new MapNode("root"))
				.flatMapValue(resultNode -> serializeList(this.children(), RootChild::serialize, "Root", "children").mapValue(children -> resultNode.withNodeList("children", children)));
		}
	}
}