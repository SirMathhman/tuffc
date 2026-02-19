package com.meti;
import java.util.List;
public class JavaAST {
	public sealed interface RootChild permits Class, Interface, Record {}
	public record Type(String name) {
		public static void /*Type */deserialize(MapNode node){
			// return new Type(node.findString("name").orElse("?"));
		}
	}
	public record Declaration(String name, Type type) {
		public static void /*Declaration */deserialize(MapNode node){
			// return new Declaration(node.findString("name").orElse("?"));
		}
	}
	public record Class(String name) implements RootChild {
		public static void /*Class */deserialize(MapNode node){
			// return new Class(node.findString("name").orElse("?"));
		}
	}
	public record Interface(String name) implements RootChild {
		public static void /*Interface */deserialize(MapNode node){
			// return new Interface(node.findString("name").orElse("?"));
		}
	}
	public record Record(String name, List<Declaration> params) implements RootChild {
		public static void /*Record */deserialize(MapNode node){
			// return new Record(node.findString("name").orElse("?"));
		}
	}
	public record Root(List<RootChild> children) {
		public static void /*Root */deserialize(MapNode node){
			// return new Root();
		}
	}
}