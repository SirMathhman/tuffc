package com.meti;
import java.util.List;
public class JavaAST {
	public sealed interface RootChild permits Class, Interface, Record {}
	public record Class(String name) implements RootChild {}
	public record Interface(String name) implements RootChild {}
	public record Record(String name) implements RootChild {}
	public record Root(List<RootChild> children) {}
}