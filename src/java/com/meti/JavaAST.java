package com.meti;
import java.util.List;
public class JavaAST {
	public record Class(String name, String type){}
	public record Root(List<Class> classes){}
}