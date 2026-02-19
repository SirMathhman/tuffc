package com.meti;

import java.util.ArrayList;
import java.util.List;

public class JavaAST {
	public sealed interface RootChild permits Class, Interface, Record {
		static RootChild deserialize(MapNode node) {
			if (node.is("class")) {
				return Class.deserialize(node);
			}
			if (node.is("interface")) {
				return Interface.deserialize(node);
			}
			if (node.is("record")) {
				return Record.deserialize(node);
			}
			return null;
		}
	}

	public record Type(String name) {
		public static Type deserialize(MapNode node) {
			return new Type(node.findString("name").orElse("?"));
		}
	}

	public record Declaration(String name, Type type) {
		public static Declaration deserialize(MapNode node) {
			return new Declaration(node.findString("name").orElse("?"),
														 Type.deserialize(node.findNode("type").orElse(new MapNode())));
		}
	}

	public record Class(String name) implements RootChild {
		public static Class deserialize(MapNode node) {
			return new Class(node.findString("name").orElse("?"));
		}
	}

	public record Interface(String name) implements RootChild {
		public static Interface deserialize(MapNode node) {
			return new Interface(node.findString("name").orElse("?"));
		}
	}

	public record Record(String name, List<Declaration> params) implements RootChild {
		public static Record deserialize(MapNode node) {
			return new Record(node.findString("name").orElse("?"),
												node
														.findNodeList("params")
														.orElse(new ArrayList<MapNode>())
														.stream()
														.map(Declaration::deserialize)
														.toList());
		}
	}

	public record Root(List<RootChild> children) {
		public static Root deserialize(MapNode node) {
			return new Root(node
													.findNodeList("children")
													.orElse(new ArrayList<MapNode>())
													.stream()
													.map(RootChild::deserialize)
													.toList());
		}
	}
}