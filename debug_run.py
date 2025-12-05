from src.interpret import interpret

env = {}
expr = (
    "fn add(first : I32, second : I32) : I32 => { return first + second; } add(10, 20)"
)
print("start")
res = interpret(expr, env)
print("res=", res)
print("env=", env)
