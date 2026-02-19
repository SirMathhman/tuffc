package com.meti;

import java.util.function.Function;
import java.util.function.Supplier;

public sealed interface Result<T, X> permits Ok, Err {
    <R> Result<R, X> mapValue(Function<T, R> mapper);

    <R> Result<R, X> flatMapValue(Function<T, Result<R, X>> mapper);

    <R> R match(Function<T, R> whenOk, Function<X, R> whenErr);

    <R> Result<Tuple<T, R>, X> and(Supplier<Result<R, X>> mapper);

    <R> Result<T, R> mapErr(Function<X, R> mapper);

    default Result<T, X> or(Supplier<Result<T, X>> supplier) {
        return this.match(value -> this, error -> supplier.get());
    }
}
