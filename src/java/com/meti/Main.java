package com.meti;

import java.io.IOException;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.BiFunction;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

public class Main {
	private sealed interface Result<T, X> permits Err, Ok {
		<R> Result<R, X> mapValue(Function<T, R> mapper);

		<R> Result<R, X> flatMapValue(Function<T, Result<R, X>> mapper);

		<R> R match(Function<T, R> whenOk, Function<X, R> whenErr);

		<R> Result<Tuple<T, R>, X> and(Supplier<Result<R, X>> mapper);

		<R> Result<T, R> mapErr(Function<X, R> mapper);
	}

	private interface Rule {
		Result<MapNode, CompileError> lex(String value);

		Result<String, CompileError> generate(MapNode node);
	}

	private sealed interface Context permits NodeContext, StringContext {
		String display();
	}

	private interface Error {
		String display();
	}

	public interface Folder {
		State fold(State state, char c);
	}

	private interface Splitter {
		List<String> split(String input);

		String createDelimiter();
	}

	private record CompileError(String message, Context context, List<CompileError> children) implements Error {
		private CompileError(String message, Context context, List<CompileError> children) {
			this.message = message;
			this.context = context;
			this.children = children;

			this.children.sort(Comparator.comparingInt(CompileError::computeDepth));
		}

		public CompileError(String message, Context context) {
			this(message, context, new ArrayList<CompileError>());
		}

		private int computeDepth() {
			return 1 + this.children.stream().mapToInt(CompileError::computeDepth).max().orElse(0);
		}

		@Override
		public String display() {
			final var joined = this.children.stream().map(CompileError::display).collect(Collectors.joining());
			return this.message + ": '" + this.context.display() + "'" + System.lineSeparator() + joined;
		}
	}

	private record Tuple<A, B>(A left, B right) {}

	private record Ok<T, X>(T value) implements Result<T, X> {
		@Override
		public <R> Result<R, X> mapValue(Function<T, R> mapper) {
			return new Ok<R, X>(mapper.apply(this.value));
		}

		@Override
		public <R> Result<R, X> flatMapValue(Function<T, Result<R, X>> mapper) {
			return mapper.apply(this.value);
		}

		@Override
		public <R> R match(Function<T, R> whenOk, Function<X, R> whenErr) {
			return whenOk.apply(this.value);

		}

		@Override
		public <R> Result<Tuple<T, R>, X> and(Supplier<Result<R, X>> supplier) {
			return supplier.get().mapValue(otherValue -> new Tuple<T, R>(this.value, otherValue));
		}

		@Override
		public <R> Result<T, R> mapErr(Function<X, R> mapper) {
			return new Ok<T, R>(this.value);
		}

	}

	private record Err<T, X>(X error) implements Result<T, X> {
		@Override
		public <R> Result<R, X> mapValue(Function<T, R> mapper) {
			return new Err<R, X>(this.error);
		}

		@Override
		public <R> Result<R, X> flatMapValue(Function<T, Result<R, X>> mapper) {
			return new Err<R, X>(this.error);
		}

		@Override
		public <R> R match(Function<T, R> whenOk, Function<X, R> whenErr) {
			return whenErr.apply(this.error);
		}

		@Override
		public <R> Result<Tuple<T, R>, X> and(Supplier<Result<R, X>> mapper) {
			return new Err<Tuple<T, R>, X>(this.error);
		}

		@Override
		public <R> Result<T, R> mapErr(Function<X, R> mapper) {
			return new Err<T, R>(mapper.apply(this.error));
		}

	}

	private record NodeContext(MapNode node) implements Context {
		@Override
		public String display() {
			return this.node.display();
		}
	}

	private record StringRule(String key) implements Rule {
		@Override
		public Result<MapNode, CompileError> lex(String value) {
			return new Ok<MapNode, CompileError>(new MapNode().withString(this.key(), value));
		}

		@Override
		public Result<String, CompileError> generate(MapNode node) {
			return node.findString(this.key).<Result<String, CompileError>>map(Ok::new).orElseGet(() -> {
				final var error = new CompileError("Key '" + this.key + "' not found", new NodeContext(node));
				return new Err<String, CompileError>(error);
			});
		}
	}

	private record SuffixRule(Rule childRule, String suffix) implements Rule {
		@Override
		public Result<MapNode, CompileError> lex(String slice) {
			if (!slice.endsWith(this.suffix())) {
				final var error = new CompileError("Suffix '" + this.suffix + "' not present", new StringContext(slice));

				return new Err<MapNode, CompileError>(error);
			}
			final var body = slice.substring(0, slice.length() - this.suffix().length());
			return this.childRule().lex(body);
		}

		@Override
		public Result<String, CompileError> generate(MapNode node) {
			return this.childRule.generate(node).mapValue(slice -> slice + this.suffix());
		}
	}

	private record StripRule(Rule childRule) implements Rule {
		@Override
		public Result<MapNode, CompileError> lex(String substring) {
			return this.childRule().lex(substring.strip());
		}

		@Override
		public Result<String, CompileError> generate(MapNode node) {
			return this.childRule.generate(node);
		}
	}

	private record InfixRule(Rule leftRule, String infix, Rule rightRule) implements Rule {
		@Override
		public Result<MapNode, CompileError> lex(String input) {
			final var i1 = input.indexOf(this.infix());
			if (i1 < 0) {
				final var error = new CompileError("Infix '" + this.infix + "' not present", new StringContext(input));
				return new Err<MapNode, CompileError>(error);
			}

			final var substring = input.substring(0, i1);
			final var afterName = input.substring(i1 + this.infix().length());
			return this
					.leftRule()
					.lex(substring)
					.flatMapValue(inner -> this.rightRule().lex(afterName).mapValue(inner::merge));
		}

		@Override
		public Result<String, CompileError> generate(MapNode node) {
			return this.leftRule
					.generate(node)
					.flatMapValue(leftResult -> this.rightRule
							.generate(node)
							.mapValue(rightResult -> leftResult + this.infix + rightResult));
		}
	}

	private record PrefixRule(String prefix, Rule rule) implements Rule {
		@Override
		public Result<MapNode, CompileError> lex(String value) {
			if (value.startsWith(this.prefix)) {
				return this.rule.lex(value.substring(this.prefix.length()));
			}
			return new Err<MapNode, CompileError>(new CompileError("Prefix '" + this.prefix + "' not present",
																														 new StringContext(value)));
		}

		@Override
		public Result<String, CompileError> generate(MapNode node) {
			return this.rule.generate(node).mapValue(slice -> this.prefix + slice);
		}
	}

	private record NodeListRule(String key, Rule rule, Splitter splitter) implements Rule {
		@Override
		public Result<MapNode, CompileError> lex(String value) {
			return this.splitter
					.split(value)
					.stream()
					.<Result<List<MapNode>, CompileError>>reduce(new Ok<List<MapNode>, CompileError>(new ArrayList<MapNode>()),
																											 (listCompileErrorResult, segment) -> listCompileErrorResult
																													 .and(() -> this.rule.lex(segment))
																													 .mapValue(Main::getMapNodes),
																											 (_, next) -> next)
					.mapValue(segments -> new MapNode().withNodeList(this.key, segments));
		}

		@Override
		public Result<String, CompileError> generate(MapNode node) {
			return node.findNodeList(this.key).map(this::reduceChildren).orElseGet(() -> {
				final var error = new CompileError("Key '" + this.key + "' not present", new NodeContext(node));
				return new Err<String, CompileError>(error);
			});
		}

		private Result<String, CompileError> reduceChildren(List<MapNode> list) {
			return list.stream().map(this.rule::generate).reduce(new Ok<String, CompileError>(""), optionally((s, s2) -> {
				if (s.isEmpty()) {
					return s2;
				}

				return s + this.splitter.createDelimiter() + s2;
			}), (_, next) -> next);
		}
	}

	private record OrRule(List<Rule> rules) implements Rule {
		public static Rule from(Rule... rules) {
			return new OrRule(Arrays.asList(rules));
		}

		@Override
		public Result<MapNode, CompileError> lex(String value) {
			return this.rules
					.stream()
					.reduce(new Accumulator<MapNode>(),
									(accumulator, rule) -> rule.lex(value).match(accumulator::withValue, accumulator::withError),
									(_, next) -> next)
					.toResult()
					.mapErr(children -> new CompileError("No rule matched", new StringContext(value), children));
		}

		@Override
		public Result<String, CompileError> generate(MapNode node) {
			return this.rules
					.stream()
					.reduce(new Accumulator<String>(),
									(accumulator, rule) -> rule.generate(node).match(accumulator::withValue, accumulator::withError),
									(_, next) -> next)
					.toResult()
					.mapErr(children -> new CompileError("No rule matched", new NodeContext(node), children));
		}
	}

	private static class PlaceholderRule implements Rule {
		@Override
		public Result<MapNode, CompileError> lex(String value) {
			return new Ok<MapNode, CompileError>(new MapNode().withString("content", value));
		}

		@Override
		public Result<String, CompileError> generate(MapNode node) {
			final var content = node.findString("content").orElse("???");
			return new Ok<String, CompileError>("/*" + content + "*/");
		}
	}

	private static class LazyRule implements Rule {
		private Optional<Rule> maybeRule = Optional.empty();

		public void set(Rule other) {
			this.maybeRule = Optional.of(other);
		}

		@Override
		public Result<MapNode, CompileError> lex(String value) {
			return this.maybeRule
					.map(rule -> rule.lex(value))
					.orElseGet(() -> new Err<MapNode, CompileError>(new CompileError("Rule not set", new StringContext(value))));
		}

		@Override
		public Result<String, CompileError> generate(MapNode node) {
			return this.maybeRule
					.map(rule -> rule.generate(node))
					.orElseGet(() -> new Err<String, CompileError>(new CompileError("Rule not set", new NodeContext(node))));
		}
	}

	private record TypeRule(String type, Rule rule) implements Rule {
		@Override
		public Result<MapNode, CompileError> lex(String value) {
			return this.rule.lex(value).mapValue(node -> node.retype(this.type));
		}

		@Override
		public Result<String, CompileError> generate(MapNode node) {
			if (node.is(this.type)) {
				return this.rule.generate(node);
			}

			return new Err<String, CompileError>(new CompileError("Type '" + this.type + "' not present",
																														new NodeContext(node)));
		}
	}

	private record StringContext(String input) implements Context {
		@Override
		public String display() {
			return this.input;
		}
	}

	private record Accumulator<T>(Optional<T> maybeValue, List<CompileError> errors) {
		public Accumulator() {
			this(Optional.empty(), Collections.emptyList());
		}

		private Accumulator<T> withValue(T t) {
			return new Accumulator<T>(Optional.of(t), this.errors);
		}

		private Accumulator<T> withError(CompileError error) {
			final var copy = new ArrayList<CompileError>(this.errors);
			copy.add(error);
			return new Accumulator<T>(this.maybeValue, copy);
		}

		public Result<T, List<CompileError>> toResult() {
			return this.maybeValue
					.<Result<T, List<CompileError>>>map(Ok::new)
					.orElseGet(() -> new Err<T, List<CompileError>>(this.errors));
		}
	}

	private record JavaError(Exception e) implements Error {
		@Override
		public String display() {
			final var writer = new StringWriter();
			this.e.printStackTrace(new PrintWriter(writer));
			return writer.toString();
		}
	}

	private static class State {
		private final String input;
		private final ArrayList<String> segments;
		private int index;
		private StringBuilder buffer;
		private int depth;

		public State(String input, int index, StringBuilder buffer, int depth, ArrayList<String> segments) {
			this.input = input;
			this.index = index;
			this.buffer = buffer;
			this.depth = depth;
			this.segments = segments;
		}

		public State(String input) {
			this(input, 0, new StringBuilder(), 0, new ArrayList<String>());
		}

		private boolean isShallow() {
			return this.depth == 1;
		}

		private State exit() {
			this.depth = this.depth - 1;
			return this;
		}

		private State advance() {
			this.segments.add(this.buffer.toString());
			this.buffer = new StringBuilder();
			return this;
		}

		private State append(char c) {
			this.buffer.append(c);
			return this;
		}

		private Optional<Character> pop() {
			if (this.index >= this.input.length()) {
				return Optional.empty();
			}
			final var c = this.input.charAt(this.index);
			this.index = this.index + 1;
			return Optional.of(c);
		}

		private State enter() {
			this.depth = this.depth + 1;
			return this;
		}

		private boolean isLevel() {
			return this.depth == 0;
		}

		public Optional<Tuple<State, Character>> popAndAppendToTuple() {
			return this.pop().map(c -> {
				final var appended = this.append(c);
				return new Tuple<State, Character>(appended, c);
			});
		}

		public Optional<State> popAndAppendToOption() {
			return this.popAndAppendToTuple().map(Tuple::left);
		}
	}

	private static class StatementFolder implements Folder {
		@Override
		public State fold(State state, char c) {
			final var appended = state.append(c);
			if (c == '\'') {
				return appended.popAndAppendToTuple().flatMap(tuple -> {
					if (tuple.right == '\\') {
						return tuple.left.popAndAppendToOption();
					} else {
						return Optional.of(tuple.left);
					}
				}).flatMap(State::popAndAppendToOption).orElse(appended);
			}

			if (c == '\"') {
				var current = appended;
				while (true) {
					final var maybeNext = current.pop();
					if (maybeNext.isEmpty()) {
						break;
					}

					final char next = maybeNext.orElse('\0');
					current = current.append(next);
					if (next == '\\') {
						current = current.popAndAppendToOption().orElse(current);
					}
					if (next == '\"') {
						break;
					}
				}

				return current;
			}

			if (c == ';' && appended.isLevel()) {
				return appended.advance();
			}
			if (c == '}' && appended.isShallow()) {
				return appended.exit().advance();
			}
			if (c == '{') {
				return appended.enter();
			}
			if (c == '}') {
				return appended.exit();
			}
			return appended;
		}
	}

	public record FoldingSplitter(Folder folder) implements Splitter {
		@Override
		public List<String> split(String input) {
			var current = new State(input);
			while (true) {
				final var maybeNext = current.pop();
				if (maybeNext.isEmpty()) {
					break;
				}

				current = this.folder().fold(current, maybeNext.get());
			}

			return current.advance().segments;
		}

		@Override
		public String createDelimiter() {
			return "";
		}
	}

	private record DelimiterSplitter(String delimiter) implements Splitter {
		@Override
		public List<String> split(String input) {
			return Arrays.asList(input.split(Pattern.quote(this.delimiter)));
		}

		@Override
		public String createDelimiter() {
			return this.delimiter;
		}
	}

	private static class EmptyRule implements Rule {
		public EmptyRule() {}

		@Override
		public Result<MapNode, CompileError> lex(String value) {
			if (value.isEmpty()) {
				return new Ok<MapNode, CompileError>(new MapNode());
			}
			return new Err<MapNode, CompileError>(new CompileError("Not empty", new StringContext(value)));
		}

		@Override
		public Result<String, CompileError> generate(MapNode node) {
			return new Ok<String, CompileError>("");
		}
	}

	private static final Map<List<String>, List<String>> imports = new HashMap<List<String>, List<String>>();

	private static List<MapNode> getMapNodes(Tuple<List<MapNode>, MapNode> tuple) {
		final var left = tuple.left;
		left.add(tuple.right);
		return left;
	}

	private static <C, T> BiFunction<Result<C, CompileError>, Result<T, CompileError>, Result<C, CompileError>> optionally(
			BiFunction<C, T, C> mapper) {
		return (mapNodes, mapNode) -> mapNodes.flatMapValue(list -> mapNode.mapValue(inner -> mapper.apply(list, inner)));
	}

	public static void main(String[] args) {
		run().ifPresent(error -> System.out.println(error.display()));
	}

	private static Optional<Error> run() {
		writeNodes();

		final var javaSource = createPath("java");
		final var tuffSource = createPath("tuff");

		return switch (readString(javaSource)) {
			case Err<String, Error> v -> Optional.of(v.error);
			case Ok<String, Error> ok -> {
				final var parent = tuffSource.getParent();
				if (!Files.exists(parent)) {
					yield createDirectories(parent).map(JavaError::new);
				}

				yield switch (compile(ok.value)) {
					case Err<String, CompileError> v -> Optional.of(v.error);
					case Ok<String, CompileError> v -> writeString(tuffSource, v.value);
				};
			}
		};
	}

	private static void writeNodes() {
		final var javaGrammar = readString(Paths.get(".", "src", "resources", ".java.grammar"));
		if (javaGrammar instanceof Ok<String, Error>(var input)) {
			final var slices = input.split(Pattern.quote("\n"));

			final var segments = new ArrayList<String>();
			segments.add("package com.meti;");

			final var tuple = toLines(slices);
			tuple.left.stream().map(slice -> "import " + slice + ";").forEach(segments::add);

			segments.add("public class JavaAST {");
			segments.addAll(tuple.right);
			segments.add("}");

			writeString(Paths.get(".", "src", "java", "com", "meti", "JavaAST.java"),
									String.join(System.lineSeparator(), segments));
		}
	}

	private static Tuple<List<String>, List<String>> toLines(String[] slices) {
		final var imports = new ArrayList<String>();
		final var segments = new ArrayList<String>();

		final var variants = new HashMap<String, List<String>>();
		for (var slice : slices) {
			final var i = slice.indexOf("=");
			if (i >= 0) {
				final var name = slice.substring(0, i).strip();
				final var value = slice.substring(i + 1).strip();
				extracted(value, variants, name, segments, imports);
			}
		}

		return new Tuple<List<String>, List<String>>(imports, segments);
	}

	private static void extracted(String value,
																HashMap<String, List<String>> variants,
																String name,
																ArrayList<String> segments,
																ArrayList<String> imports) {
		if (value.contains("|")) {
			final var split = value.split(Pattern.quote("|"));
			final var list = Arrays.stream(split).map(String::strip).filter(member -> !member.isEmpty()).toList();
			variants.put(name, list);

			final var joined = String.join(", ", list);
			final var s = list.stream().map(element -> {
				final var s1 = element.toLowerCase();
				final var aClass = element;
				return "\n\t\t\tif (node.is(\"" + s1 + "\")) return " + aClass + ".deserialize(node);";
			}).collect(Collectors.joining(""));

			segments.add("\tpublic sealed interface " + name + " permits " + joined + " {\n\t\tstatic " + name +
									 " deserialize(MapNode node) {" + s + "\n\t\t\treturn null;\n" + "\t\t}\n\t}");
			return;
		}

		final var inputParams = value.split(Pattern.quote(","));
		final var outputParams = new ArrayList<String>();
		final var outputArgs = new ArrayList<String>();
		for (var arg : inputParams) {
			final var arg1 = arg.strip();
			if (arg1.startsWith("[") && arg1.endsWith("]")) {
				final var substring = arg1.substring(1, arg1.length() - 1).strip();
				final var split = substring.split(" ");
				if (split.length >= 2) {
					if (!imports.contains("java.util.List")) {
						imports.add("java.util.List");
						imports.add("java.util.ArrayList");
					}

					outputParams.add("List<" + split[0] + "> " + split[1]);
					outputArgs.add(
							"node.findNodeList(\"" + split[1] + "\").orElse(new ArrayList<MapNode>()).stream().map(" + split[0] +
							"::deserialize).toList()");
				}
			} else if (arg1.contains(" ")) {
				final var split = arg1.strip().split(" ");
				outputParams.add(split[0] + " " + split[1]);
				outputArgs.add(split[0] + ".deserialize(node.findNode(\"" + split[1] + "\").orElse(new MapNode()))");
			} else {
				outputParams.add("String " + arg1);
				outputArgs.add("node.findString(\"" + arg1 + "\").orElse(\"?\")");
			}
		}

		final var superTypes = new ArrayList<String>();
		for (var entry : variants.entrySet()) {
			if (entry.getValue().contains(name)) {
				superTypes.add(entry.getKey());
			}
		}

		final String joinedSuperTypes;
		if (superTypes.isEmpty()) {
			joinedSuperTypes = "";
		} else {
			joinedSuperTypes = " implements " + String.join(", ", superTypes);
		}

		segments.add("\tpublic record " + name + "(" + String.join(", ", outputParams) + ")" + joinedSuperTypes + " {" +
								 "\n\t\tpublic static " + name + " deserialize(MapNode node){\n\t\t\treturn new " + name + "(" +
								 String.join(",\n\t\t\t\t", outputArgs) + ");\n\t\t}" + "\n\t}");
	}

	private static Optional<Error> writeString(Path target, String output) {
		try {
			Files.writeString(target, output);
			return Optional.empty();
		} catch (IOException e) {
			return Optional.of(new JavaError(e));
		}
	}

	private static Optional<IOException> createDirectories(Path parent) {
		try {
			Files.createDirectories(parent);
			return Optional.empty();
		} catch (IOException e) {
			return Optional.of(e);
		}
	}

	private static Result<String, Error> readString(Path path) {
		try {
			return new Ok<String, Error>(Files.readString(path));
		} catch (IOException e) {
			return new Err<String, Error>(new JavaError(e));
		}
	}

	private static Result<String, CompileError> compile(String input) {
		final var classSegmentRule = new LazyRule();
		classSegmentRule.set(createClassSegmentRule(classSegmentRule));

		final var moduleMemberRule = new LazyRule();
		moduleMemberRule.set(OrRule.from(createExternLetRule(), createObjectRule(moduleMemberRule)));

		final var classRule = createClassRule(classSegmentRule);
		final var sourceRootRule =
				new NodeListRule("children", createJavaRootSegmentRule(classRule), new FoldingSplitter(new StatementFolder()));

		final var targetRootRule = new NodeListRule("children",
																								new SuffixRule(OrRule.from(moduleMemberRule), System.lineSeparator()),
																								new FoldingSplitter(new StatementFolder()));

		return sourceRootRule.lex(input).flatMapValue(Main::transformAST).flatMapValue(targetRootRule::generate);
	}

	private static TypeRule createExternLetRule() {
		final var children = new NodeListRule("children", new StringRule("child"), new DelimiterSplitter(", "));
		final var namespace = new NodeListRule("namespace", new StringRule("segment"), new DelimiterSplitter("::"));

		return new TypeRule("extern let",
												new PrefixRule("extern let { ",
																			 new InfixRule(children, " } = ", new SuffixRule(namespace, ";"))));
	}

	private static Result<MapNode, CompileError> transformAST(MapNode node) {
		final var oldChildren = node
				.findNodeList("children")
				.orElse(Collections.emptyList())
				.stream()
				.map(Main::transformRootSegment)
				.flatMap(Optional::stream)
				.toList();

		final var newChildren = new ArrayList<MapNode>();
		imports.forEach((key, value) -> {
			final var children = value.stream().map(child -> new MapNode().withString("child", child)).toList();
			final var namespace = key.stream().map(segment -> new MapNode().withString("segment", segment)).toList();

			newChildren.add(new MapNode("extern let")
													.withNodeList("children", children)
													.withNodeList("namespace", namespace));
		});

		newChildren.addAll(oldChildren);

		return new Ok<MapNode, CompileError>(node.withNodeList("children", newChildren));
	}

	private static Optional<MapNode> transformRootSegment(MapNode node) {
		if (node.is("whitespace") || node.is("package")) {
			return Optional.empty();
		}

		if (node.is("import")) {
			final var segments = node
					.findNodeList("segments")
					.orElse(Collections.emptyList())
					.stream()
					.map(segment -> segment.findString("segment").orElse(""))
					.toList();

			final var namespace = segments.subList(0, segments.size() - 1);
			if (!imports.containsKey(namespace)) {
				imports.put(namespace, new ArrayList<String>());
			}

			imports.get(namespace).add(segments.getLast());
			return Optional.empty();
		}

		if (node.is("class")) {
			return Optional.of(node.retype("object"));
		}

		return Optional.of(node);
	}

	private static Rule createJavaRootSegmentRule(Rule classRule) {
		return OrRule.from(createWhitespaceRule(),
											 createNamespacedRule("package"),
											 createNamespacedRule("import"),
											 classRule);
	}

	private static TypeRule createWhitespaceRule() {
		return new TypeRule("whitespace", new StripRule(new EmptyRule()));
	}

	private static TypeRule createNamespacedRule(String type) {
		final var segments = new NodeListRule("segments", new StringRule("segment"), new DelimiterSplitter("."));
		return new TypeRule(type, new StripRule(new PrefixRule(type + " ", new SuffixRule(segments, ";"))));
	}

	private static Rule createClassRule(Rule classSegmentRule) {
		return createStructureRule("class", classSegmentRule);
	}

	private static Rule createStructureRule(String type, Rule classSegmentRule) {
		final var modifiers = new StringRule("modifiers");
		final var name = new StripRule(new StringRule("name"));
		final var body = new NodeListRule("body", classSegmentRule, new FoldingSplitter(new StatementFolder()));
		final var rightRule = new InfixRule(name, "{", new SuffixRule(new StripRule(body), "}"));
		return new TypeRule(type, new InfixRule(modifiers, type + " ", rightRule));
	}

	private static Rule createClassSegmentRule(Rule classMemberRule) {
		return OrRule.from(createStructureRule("interface", classMemberRule),
											 createStructureRule("record", classMemberRule),
											 createClassRule(classMemberRule));
	}

	private static Rule createObjectRule(LazyRule moduleMemberRule) {
		final var name = new StringRule("name");
		final var body = new NodeListRule("body", moduleMemberRule, new FoldingSplitter(new StatementFolder()));
		return new TypeRule("object", new PrefixRule("out object ", new InfixRule(name, " {", new SuffixRule(body, "}"))));
	}

	private static Path createPath(String extension) {
		return Paths.get(".", "src", extension, "com", "meti", "Main." + extension);
	}
}
