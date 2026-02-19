package com.meti;

import java.util.function.Function;
import java.util.function.Supplier;

public record Err<T, X>(X error) implements Result<T, X> {
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
