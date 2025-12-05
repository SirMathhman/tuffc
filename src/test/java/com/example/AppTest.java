package com.example;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

public class AppTest {
    @Test
    public void testGreetingDefault() {
        assertEquals("Hello, world!", App.greeting(""));
    }

    @Test
    public void testGreetingName() {
        assertEquals("Hello, Alice!", App.greeting("Alice"));
    }
}
