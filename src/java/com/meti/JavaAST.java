package com.meti;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.function.Function;

public class JavaAST {
    private static <T> Result<List<T>, String> deserializeList(Optional<List<MapNode>> maybeNodes,
            Function<MapNode, Result<T, String>> deserializer,
            String ownerType,
            String key) {
        final var nodes = maybeNodes.orElse(new ArrayList<MapNode>());
        final var values = new ArrayList<T>();
        for (var i = 0; i < nodes.size(); i++) {
            final var index = i;
            final var itemResult = deserializer.apply(nodes.get(i));
            final var maybeError = itemResult.match(value -> {
                values.add(value);
                return Optional.<String>empty();
            }, error -> Optional.of(
                    "Failed to deserialize list field '" + key + "' on '" + ownerType + "' at index " + index + ": "
                            + error));
            if (maybeError.isPresent()) {
                return new Err<List<T>, String>(maybeError.get());
            }
        }
        return new Ok<List<T>, String>(values);
    }

    private static <T> Result<List<MapNode>, String> serializeList(List<T> list,
            Function<T, Result<MapNode, String>> serializer,
            String ownerType,
            String key) {
        final var nodes = new ArrayList<MapNode>();
        for (var i = 0; i < list.size(); i++) {
            final var index = i;
            final var itemResult = serializer.apply(list.get(i));
            final var maybeError = itemResult.match(value -> {
                nodes.add(value);
                return Optional.<String>empty();
            }, error -> Optional.of(
                    "Failed to serialize list field '" + key + "' on '" + ownerType + "' at index " + index + ": "
                            + error));
            if (maybeError.isPresent()) {
                return new Err<List<MapNode>, String>(maybeError.get());
            }
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
    }

    public record Type(String name) {
        public static Result<Type, String> deserialize(MapNode node) {
            if (!node.is("type")) {
                return new Err<Type, String>("Expected type 'type'");
            }
            final var nameResult = node.findString("name")
                    .<Result<String, String>>map(Ok::new)
                    .orElseGet(() -> new Err<String, String>("Missing string field 'name' for type 'Type'"));
            return nameResult.mapValue(Type::new);
        }

        public Result<MapNode, String> serialize() {
            return new Ok<MapNode, String>(new MapNode("type").withString("name", this.name()));
        }
    }

    public record Declaration(String name, Type type) {
        public static Result<Declaration, String> deserialize(MapNode node) {
            if (!node.is("declaration")) {
                return new Err<Declaration, String>("Expected type 'declaration'");
            }
            final var nameResult = node.findString("name")
                    .<Result<String, String>>map(Ok::new)
                    .orElseGet(() -> new Err<String, String>("Missing string field 'name' for type 'Declaration'"));
            final var typeResult = node.findNode("type")
                    .map(Type::deserialize)
                    .orElseGet(() -> new Err<Type, String>("Missing node field 'type' for type 'Declaration'"))
                    .mapErr(error -> "Failed to deserialize field 'type' for type 'Declaration': " + error);
            return nameResult
                    .flatMapValue(nameValue -> typeResult.mapValue(typeValue -> new Declaration(nameValue, typeValue)));
        }

        public Result<MapNode, String> serialize() {
            return this.type().serialize()
                    .mapErr(error -> "Failed to serialize field 'type' for type 'Declaration': " + error)
                    .mapValue(typeNode -> new MapNode("declaration")
                            .withString("name", this.name())
                            .withNode("type", typeNode));
        }
    }

    public record Class(String name) implements Structure {
        public static Result<Class, String> deserialize(MapNode node) {
            if (!node.is("class")) {
                return new Err<Class, String>("Expected type 'class'");
            }
            final var nameResult = node.findString("name")
                    .<Result<String, String>>map(Ok::new)
                    .orElseGet(() -> new Err<String, String>("Missing string field 'name' for type 'Class'"));
            return nameResult.mapValue(Class::new);
        }

        @Override
        public Result<MapNode, String> serialize() {
            return new Ok<MapNode, String>(new MapNode("class").withString("name", this.name()));
        }
    }

    public record Interface(String name) implements Structure {
        public static Result<Interface, String> deserialize(MapNode node) {
            if (!node.is("interface")) {
                return new Err<Interface, String>("Expected type 'interface'");
            }
            final var nameResult = node.findString("name")
                    .<Result<String, String>>map(Ok::new)
                    .orElseGet(() -> new Err<String, String>("Missing string field 'name' for type 'Interface'"));
            return nameResult.mapValue(Interface::new);
        }

        @Override
        public Result<MapNode, String> serialize() {
            return new Ok<MapNode, String>(new MapNode("interface").withString("name", this.name()));
        }
    }

    public record Record(String name, List<Declaration> params) implements Structure {
        public static Result<Record, String> deserialize(MapNode node) {
            if (!node.is("record")) {
                return new Err<Record, String>("Expected type 'record'");
            }
            final var nameResult = node.findString("name")
                    .<Result<String, String>>map(Ok::new)
                    .orElseGet(() -> new Err<String, String>("Missing string field 'name' for type 'Record'"));
            final var paramsResult = deserializeList(node.findNodeList("params"), Declaration::deserialize, "Record",
                    "params");
            return nameResult.flatMapValue(
                    nameValue -> paramsResult.mapValue(paramValues -> new Record(nameValue, paramValues)));
        }

        @Override
        public Result<MapNode, String> serialize() {
            return serializeList(this.params(), Declaration::serialize, "Record", "params")
                    .mapValue(paramNodes -> new MapNode("record")
                            .withString("name", this.name())
                            .withNodeList("params", paramNodes));
        }
    }

    public record NamespaceSegment(String segment) {
        public static Result<NamespaceSegment, String> deserialize(MapNode node) {
            if (!node.is("namespacesegment")) {
                return new Err<NamespaceSegment, String>("Expected type 'namespacesegment'");
            }
            final var segmentResult = node.findString("segment")
                    .<Result<String, String>>map(Ok::new)
                    .orElseGet(() -> new Err<String, String>(
                            "Missing string field 'segment' for type 'NamespaceSegment'"));
            return segmentResult.mapValue(NamespaceSegment::new);
        }

        public Result<MapNode, String> serialize() {
            return new Ok<MapNode, String>(new MapNode("namespacesegment").withString("segment", this.segment()));
        }
    }

    public record Import(List<NamespaceSegment> segments) implements RootChild {
        public static Result<Import, String> deserialize(MapNode node) {
            if (!node.is("import")) {
                return new Err<Import, String>("Expected type 'import'");
            }
            final var segmentsResult = deserializeList(node.findNodeList("segments"), NamespaceSegment::deserialize,
                    "Import", "segments");
            return segmentsResult.mapValue(Import::new);
        }

        @Override
        public Result<MapNode, String> serialize() {
            return serializeList(this.segments(), NamespaceSegment::serialize, "Import", "segments")
                    .mapValue(segmentNodes -> new MapNode("import").withNodeList("segments", segmentNodes));
        }
    }

    public record Package(List<NamespaceSegment> segments) implements RootChild {
        public static Result<Package, String> deserialize(MapNode node) {
            if (!node.is("package")) {
                return new Err<Package, String>("Expected type 'package'");
            }
            final var segmentsResult = deserializeList(node.findNodeList("segments"), NamespaceSegment::deserialize,
                    "Package", "segments");
            return segmentsResult.mapValue(Package::new);
        }

        @Override
        public Result<MapNode, String> serialize() {
            return serializeList(this.segments(), NamespaceSegment::serialize, "Package", "segments")
                    .mapValue(segmentNodes -> new MapNode("package").withNodeList("segments", segmentNodes));
        }
    }

    public record Root(List<RootChild> children) {
        public static Result<Root, String> deserialize(MapNode node) {
            if (!node.is("root")) {
                return new Err<Root, String>("Expected type 'root'");
            }
            final var childrenResult = deserializeList(node.findNodeList("children"), RootChild::deserialize, "Root",
                    "children");
            return childrenResult.mapValue(Root::new);
        }

        public Result<MapNode, String> serialize() {
            return serializeList(this.children(), RootChild::serialize, "Root", "children")
                    .mapValue(childNodes -> new MapNode("root").withNodeList("children", childNodes));
        }
    }
}
