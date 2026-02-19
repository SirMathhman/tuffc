package com.meti;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public final class MapNode {
	private final Map<String, String> strings = new HashMap<String, String>();
	private final Map<String, MapNode> nodes = new HashMap<String, MapNode>();
	private final Map<String, List<MapNode>> nodeLists = new HashMap<String, List<MapNode>>();
	private Optional<String> maybeType = Optional.empty();

	public MapNode(String type) {
		this.maybeType = Optional.of(type);
	}

	public MapNode() {
	}

	@Override
	public String toString() {
		final var s = this.maybeType.map(type -> "maybeType=" + type + ", ").orElse("");
		final String s1;
		if (this.strings.isEmpty()) {
			s1 = "";
		} else {
			s1 = "strings=" + this.strings + ", ";
		}

		final String s2;
		if (this.nodeLists.isEmpty()) {
			s2 = "";
		} else {
			s2 = "nodeLists=" + this.nodeLists;
		}

		return "MapNode {" + s + s1 + s2 + '}';
	}

	public MapNode withString(String key, String value) {
		this.strings.put(key, value);
		return this;
	}

	public Optional<String> findString(String key) {
		return Optional.ofNullable(this.strings.get(key));
	}

	public MapNode merge(MapNode other) {
		this.strings.putAll(other.strings);
		this.nodeLists.putAll(other.nodeLists);
		return this;
	}

	public MapNode withNodeList(String key, List<MapNode> nodes) {
		this.nodeLists.put(key, nodes);
		return this;
	}

	public Optional<List<MapNode>> findNodeList(String key) {
		return Optional.ofNullable(this.nodeLists.get(key));
	}

	public boolean is(String type) {
		return this.maybeType.isPresent() && this.maybeType.get().equals(type);
	}

	public MapNode retype(String type) {
		this.maybeType = Optional.of(type);
		return this;
	}

	public String display() {
		/*
		TODO: something better
		*/
		return this.toString();
	}

	public Optional<MapNode> findNode(String key) {
		return Optional.ofNullable(this.nodes.get(key));
	}
}
