package com.example;

public class App {
	public static void main(String[] args) {
		System.out.println("Hello from tuffc!");
	}

	public static String greeting(String name) {
		if (name == null || name.isEmpty())
			return "Hello, world!";
		return "Hello, " + name + "!";
	}
}
