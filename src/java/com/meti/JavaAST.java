package com.meti;

import java.util.Optional;
import java.util.function.Function;
import java.util.List;
import java.util.ArrayList;

public class JavaAST {
	private static <T> Optional<List<T>> deserializeList(Optional<List<MapNode>> maybeNodes,
			Function<MapNode, Optional<T>> deserializer) {
		final var nodes = maybeNodes.orElse(new ArrayList<MapNode>());
		final var list = new ArrayList<T>();
		for (var child : nodes) {
			final var maybeItem = deserializer.apply(child);
			if (maybeItem.isEmpty())
				return Optional.empty();
			list.add(maybeItem.get());
		}
		return Optional.of(list);
	}

	public sealed interface RootChild permits Package, Import, Structure {
		static Optional<RootChild> deserialize(MapNode node) {
			return Package.deserialize(node).map(value -> (RootChild) value)
					.or(() -> Import.deserialize(node).map(value -> (RootChild) value))
					.or(() -> Structure.deserialize(node).map(value -> (RootChild) value));
		}

		MapNode serialize();
	}

	public sealed interface Structure extends RootChild permits Class, Interface, Record {
		static Optional<Structure> deserialize(MapNode node) {
			return Class.deserialize(node).map(value -> (Structure) value)
					.or(() -> Interface.deserialize(node).map(value -> (Structure) value))
					.or(() -> Record.deserialize(node).map(value -> (Structure) value));
		}

		MapNode serialize();
	}

	public record Type(String name) {
		public static Optional<Type> deserialize(MapNode node) {
			if (!node.is("type"))
				return Optional.empty();
			final var maybeName = node.findString("name");
			if (maybeName.isEmpty())
				return Optional.empty();
			return Optional.of(new Type(maybeName.get()));
		}

		public MapNode serialize() {
			return new MapNode("type")
					.withString("name", this.name());
		}
	}

	public record Declaration(String name, Type type) {
		public static Optional<Declaration> deserialize(MapNode node) {
			if (!node.is("declaration"))
				return Optional.empty();
			final var maybeName = node.findString("name");
			if (maybeName.isEmpty())
				return Optional.empty();
			final var maybeType = node.findNode("type").flatMap(Type::deserialize);
			if (maybeType.isEmpty())
				return Optional.empty();
			return Optional.of(new Declaration(maybeName.get(),
					maybeType.get()));
		}

		public MapNode serialize() {
			return new MapNode("declaration")
					.withString("name", this.name())
					.withNode("type", this.type().serialize());
		}
	}

	public record Class(String name) implements Structure {
		public static Optional<Class> deserialize(MapNode node) {
			if (!node.is("class"))
				return Optional.empty();
			final var maybeName = node.findString("name");
			if (maybeName.isEmpty())
				return Optional.empty();
			return Optional.of(new Class(maybeName.get()));
		}

		@Override
		public MapNode serialize() {
			return new MapNode("class")
					.withString("name", this.name());
		}
	}

	public record Interface(String name) implements Structure {
		public static Optional<Interface> deserialize(MapNode node) {
			if (!node.is("interface"))
				return Optional.empty();
			final var maybeName = node.findString("name");
			if (maybeName.isEmpty())
				return Optional.empty();
			return Optional.of(new Interface(maybeName.get()));
		}

		@Override
		public MapNode serialize() {
			return new MapNode("interface")
					.withString("name", this.name());
		}
	}

	public record Record(String name, List<Declaration> params) implements Structure {
		public static Optional<Record> deserialize(MapNode node) {
			if (!node.is("record"))
				return Optional.empty();
			final var maybeName = node.findString("name");
			if (maybeName.isEmpty())
				return Optional.empty();
			final var maybeParams = deserializeList(node.findNodeList("params"), Declaration::deserialize);
			if (maybeParams.isEmpty())
				return Optional.empty();
			return Optional.of(new Record(maybeName.get(),
					maybeParams.get()));
		}

		@Override
		public MapNode serialize() {
			return new MapNode("record")
					.withString("name", this.name())
					.withNodeList("params", this.params().stream().map(Declaration::serialize).toList());
		}
	}

	public record NamespaceSegment(String segment) {
		public static Optional<NamespaceSegment> deserialize(MapNode node) {
			if (!node.is("namespacesegment"))
				return Optional.empty();
			final var maybeSegment = node.findString("segment");
			if (maybeSegment.isEmpty())
				return Optional.empty();
			return Optional.of(new NamespaceSegment(maybeSegment.get()));
		}

		public MapNode serialize() {
			return new MapNode("namespacesegment")
					.withString("segment", this.segment());
		}
	}

	public record Import(List<NamespaceSegment> segments) implements RootChild {
		public static Optional<Import> deserialize(MapNode node) {
			if (!node.is("import"))
				return Optional.empty();
			final var maybeSegments = deserializeList(node.findNodeList("segments"), NamespaceSegment::deserialize);
			if (maybeSegments.isEmpty())
				return Optional.empty();
			return Optional.of(new Import(maybeSegments.get()));
		}

		@Override
		public MapNode serialize() {
			return new MapNode("import")
					.withNodeList("segments", this.segments().stream().map(NamespaceSegment::serialize).toList());
		}
	}

	public record Package(List<NamespaceSegment> segments) implements RootChild {
		public static Optional<Package> deserialize(MapNode node) {
			if (!node.is("package"))
				return Optional.empty();
			final var maybeSegments = deserializeList(node.findNodeList("segments"), NamespaceSegment::deserialize);
			if (maybeSegments.isEmpty())
				return Optional.empty();
			return Optional.of(new Package(maybeSegments.get()));
		}

		@Override
		public MapNode serialize() {
			return new MapNode("package")
					.withNodeList("segments", this.segments().stream().map(NamespaceSegment::serialize).toList());
		}
	}

	public record Root(List<RootChild> children) {
		public static Optional<Root> deserialize(MapNode node) {
			if (!node.is("root"))
				return Optional.empty();
			final var maybeChildren = deserializeList(node.findNodeList("children"), RootChild::deserialize);
			if (maybeChildren.isEmpty())
				return Optional.empty();
			return Optional.of(new Root(maybeChildren.get()));
		}

		public MapNode serialize() {
			return new MapNode("root")
					.withNodeList("children", this.children().stream().map(RootChild::serialize).toList());
		}
	}
}