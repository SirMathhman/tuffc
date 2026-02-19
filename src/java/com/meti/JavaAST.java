package com.meti;
import java.util.List;
public class JavaAST {
	public sealed interface Segment permits Class, Interface {}
	public record Class(String name, String type) implements Segment {}
	public record Interface(String name) implements Segment {}
	public record Root(List<Class> classes) {}
}