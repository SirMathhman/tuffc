package com.meti;
import java.util.Optional;
import java.util.function.Function;
import java.util.List;
import java.util.ArrayList;
public class JavaAST {
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
	public sealed interface RootChild permits Package, Import, Structure {
		static Result<RootChild, String> deserialize(MapNode node) {
			return Package.deserialize(node).mapValue(value -> (RootChild) value)
				.or(() -> Import.deserialize(node).mapValue(value -> (RootChild) value))
				.or(() -> Structure.deserialize(node).mapValue(value -> (RootChild) value));
		}

		Result<MapNode, String> serialize();
	}
	public sealed interface Structure extends RootChild permits Class, Interface, Record {
		static Result<Structure, String> deserialize(MapNode node) {
			return Class.deserialize(node).mapValue(value -> (Structure) value)
				.or(() -> Interface.deserialize(node).mapValue(value -> (Structure) value))
				.or(() -> Record.deserialize(node).mapValue(value -> (Structure) value));
		}

		Result<MapNode, String> serialize();
	}
	public record Type(String name) {
		public static Result<Type, String> deserialize(MapNode node){
			if (!node.is("type")) return new Err<Type, String>("Expected type 'type'");
			final var maybeName = node.findString("name").<Result<String, String>>map(Ok::new).orElseGet(() -> new Err<String, String>("Missing string field 'name' for type 'Type'"));
			if (maybeName instanceof Err<?, String>(var error)) return new Err<Type, String>(error);
			return new Ok<Type, String>(new Type(maybeName.match(value -> value, error -> null)));
		}
		@Override
		public Result<MapNode, String> serialize() {
			return new Ok<MapNode, String>(new MapNode("type"))
				.mapValue(resultNode -> resultNode.withString("name", this.name()));
		}
	}
	public record Declaration(String name, Type type) {
		public static Result<Declaration, String> deserialize(MapNode node){
			if (!node.is("declaration")) return new Err<Declaration, String>("Expected type 'declaration'");
			final var maybeName = node.findString("name").<Result<String, String>>map(Ok::new).orElseGet(() -> new Err<String, String>("Missing string field 'name' for type 'Declaration'"));
			if (maybeName instanceof Err<?, String>(var error)) return new Err<Declaration, String>(error);
			final var maybeType = node.findNode("type").map(Type::deserialize).orElseGet(() -> new Err<Type, String>("Missing node field 'type' for type 'Declaration'"));
			if (maybeType instanceof Err<?, String>(var error)) return new Err<Declaration, String>(error);
			return new Ok<Declaration, String>(new Declaration(maybeName.match(value -> value, error -> null),
				maybeType.match(value -> value, error -> null)));
		}
		@Override
		public Result<MapNode, String> serialize() {
			return new Ok<MapNode, String>(new MapNode("declaration"))
				.mapValue(resultNode -> resultNode.withString("name", this.name()))
				.flatMapValue(resultNode -> this.type().serialize().mapErr(error -> "Failed to serialize field 'type' for type 'Declaration': " + error).mapValue(child -> resultNode.withNode("type", child)));
		}
	}
	public record Class(String name) implements Structure {
		public static Result<Class, String> deserialize(MapNode node){
			if (!node.is("class")) return new Err<Class, String>("Expected type 'class'");
			final var maybeName = node.findString("name").<Result<String, String>>map(Ok::new).orElseGet(() -> new Err<String, String>("Missing string field 'name' for type 'Class'"));
			if (maybeName instanceof Err<?, String>(var error)) return new Err<Class, String>(error);
			return new Ok<Class, String>(new Class(maybeName.match(value -> value, error -> null)));
		}
		@Override
		public Result<MapNode, String> serialize() {
			return new Ok<MapNode, String>(new MapNode("class"))
				.mapValue(resultNode -> resultNode.withString("name", this.name()));
		}
	}
	public record Interface(String name) implements Structure {
		public static Result<Interface, String> deserialize(MapNode node){
			if (!node.is("interface")) return new Err<Interface, String>("Expected type 'interface'");
			final var maybeName = node.findString("name").<Result<String, String>>map(Ok::new).orElseGet(() -> new Err<String, String>("Missing string field 'name' for type 'Interface'"));
			if (maybeName instanceof Err<?, String>(var error)) return new Err<Interface, String>(error);
			return new Ok<Interface, String>(new Interface(maybeName.match(value -> value, error -> null)));
		}
		@Override
		public Result<MapNode, String> serialize() {
			return new Ok<MapNode, String>(new MapNode("interface"))
				.mapValue(resultNode -> resultNode.withString("name", this.name()));
		}
	}
	public record Record(String name, List<Declaration> params) implements Structure {
		public static Result<Record, String> deserialize(MapNode node){
			if (!node.is("record")) return new Err<Record, String>("Expected type 'record'");
			final var maybeName = node.findString("name").<Result<String, String>>map(Ok::new).orElseGet(() -> new Err<String, String>("Missing string field 'name' for type 'Record'"));
			if (maybeName instanceof Err<?, String>(var error)) return new Err<Record, String>(error);
			final var maybeParams = deserializeList(node.findNodeList("params"), Declaration::deserialize, "Record", "params");
			if (maybeParams instanceof Err<?, String>(var error)) return new Err<Record, String>(error);
			return new Ok<Record, String>(new Record(maybeName.match(value -> value, error -> null),
				maybeParams.match(value -> value, error -> null)));
		}
		@Override
		public Result<MapNode, String> serialize() {
			return new Ok<MapNode, String>(new MapNode("record"))
				.mapValue(resultNode -> resultNode.withString("name", this.name()))
				.flatMapValue(resultNode -> serializeList(this.params(), Declaration::serialize, "Record", "params").mapValue(children -> resultNode.withNodeList("params", children)));
		}
	}
	public record NamespaceSegment(String segment) {
		public static Result<NamespaceSegment, String> deserialize(MapNode node){
			if (!node.is("namespacesegment")) return new Err<NamespaceSegment, String>("Expected type 'namespacesegment'");
			final var maybeSegment = node.findString("segment").<Result<String, String>>map(Ok::new).orElseGet(() -> new Err<String, String>("Missing string field 'segment' for type 'NamespaceSegment'"));
			if (maybeSegment instanceof Err<?, String>(var error)) return new Err<NamespaceSegment, String>(error);
			return new Ok<NamespaceSegment, String>(new NamespaceSegment(maybeSegment.match(value -> value, error -> null)));
		}
		@Override
		public Result<MapNode, String> serialize() {
			return new Ok<MapNode, String>(new MapNode("namespacesegment"))
				.mapValue(resultNode -> resultNode.withString("segment", this.segment()));
		}
	}
	public record Import(List<NamespaceSegment> segments) implements RootChild {
		public static Result<Import, String> deserialize(MapNode node){
			if (!node.is("import")) return new Err<Import, String>("Expected type 'import'");
			final var maybeSegments = deserializeList(node.findNodeList("segments"), NamespaceSegment::deserialize, "Import", "segments");
			if (maybeSegments instanceof Err<?, String>(var error)) return new Err<Import, String>(error);
			return new Ok<Import, String>(new Import(maybeSegments.match(value -> value, error -> null)));
		}
		@Override
		public Result<MapNode, String> serialize() {
			return new Ok<MapNode, String>(new MapNode("import"))
				.flatMapValue(resultNode -> serializeList(this.segments(), NamespaceSegment::serialize, "Import", "segments").mapValue(children -> resultNode.withNodeList("segments", children)));
		}
	}
	public record Package(List<NamespaceSegment> segments) implements RootChild {
		public static Result<Package, String> deserialize(MapNode node){
			if (!node.is("package")) return new Err<Package, String>("Expected type 'package'");
			final var maybeSegments = deserializeList(node.findNodeList("segments"), NamespaceSegment::deserialize, "Package", "segments");
			if (maybeSegments instanceof Err<?, String>(var error)) return new Err<Package, String>(error);
			return new Ok<Package, String>(new Package(maybeSegments.match(value -> value, error -> null)));
		}
		@Override
		public Result<MapNode, String> serialize() {
			return new Ok<MapNode, String>(new MapNode("package"))
				.flatMapValue(resultNode -> serializeList(this.segments(), NamespaceSegment::serialize, "Package", "segments").mapValue(children -> resultNode.withNodeList("segments", children)));
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