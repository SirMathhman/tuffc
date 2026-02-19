package com.meti;
import java.util.List;
public class JavaAST {
	public sealed interface RootChild permits Class, Interface, Record {}
	public record Type(String name) {}
	public record Declaration(String name, Type type) {}
	public record Class(String name) implements RootChild {}
	public record Interface(String name) implements RootChild {}
	public record Record(String name, List<Declaration> params) implements RootChild {}
	public record Root(List<RootChild> children) {}
}