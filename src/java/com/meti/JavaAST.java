package com.meti;
import java.util.List;
import java.util.ArrayList;
public class JavaAST {
	public sealed interface RootChild permits Package, Import, Structure {
		static RootChild deserialize(MapNode node) {
			if (node.is("package")) return Package.deserialize(node);
			if (node.is("import")) return Import.deserialize(node);
			if (node.is("structure")) return Structure.deserialize(node);
			return null;
		}
	}
	public sealed interface Structure extends RootChild permits Class, Interface, Record {
		static Structure deserialize(MapNode node) {
			if (node.is("class")) return Class.deserialize(node);
			if (node.is("interface")) return Interface.deserialize(node);
			if (node.is("record")) return Record.deserialize(node);
			return null;
		}
	}
	public record Type(String name) {
		public static Type deserialize(MapNode node){
			return new Type(node.findString("name").orElse("?"));
		}
	}
	public record Declaration(String name, Type type) {
		public static Declaration deserialize(MapNode node){
			return new Declaration(node.findString("name").orElse("?"),
				Type.deserialize(node.findNode("type").orElse(new MapNode())));
		}
	}
	public record Class(String name) implements Structure {
		public static Class deserialize(MapNode node){
			return new Class(node.findString("name").orElse("?"));
		}
	}
	public record Interface(String name) implements Structure {
		public static Interface deserialize(MapNode node){
			return new Interface(node.findString("name").orElse("?"));
		}
	}
	public record Record(String name, List<Declaration> params) implements Structure {
		public static Record deserialize(MapNode node){
			return new Record(node.findString("name").orElse("?"),
				node.findNodeList("params").orElse(new ArrayList<MapNode>()).stream().map(Declaration::deserialize).toList());
		}
	}
	public record NamespaceSegment(String segment) {
		public static NamespaceSegment deserialize(MapNode node){
			return new NamespaceSegment(node.findString("segment").orElse("?"));
		}
	}
	public record Import(List<NamespaceSegment> segments) implements RootChild {
		public static Import deserialize(MapNode node){
			return new Import(node.findNodeList("segments").orElse(new ArrayList<MapNode>()).stream().map(NamespaceSegment::deserialize).toList());
		}
	}
	public record Package(List<NamespaceSegment> segments) implements RootChild {
		public static Package deserialize(MapNode node){
			return new Package(node.findNodeList("segments").orElse(new ArrayList<MapNode>()).stream().map(NamespaceSegment::deserialize).toList());
		}
	}
	public record Root(List<RootChild> children) {
		public static Root deserialize(MapNode node){
			return new Root(node.findNodeList("children").orElse(new ArrayList<MapNode>()).stream().map(RootChild::deserialize).toList());
		}
	}
}