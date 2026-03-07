/* global module */

function createList(capacity, data, length) {
  return {
    __tuffSlice: true,
    data,
    start: 0,
    end: capacity,
    length: capacity,
    __tuffArrayListLength: length,
    __tuffArrayListCapacity: capacity,
  };
}

module.exports = {
  malloc: (capacity) => {
    const size = Number(capacity);
    return createList(size, Array(size).fill(0), 0);
  },
  realloc: (list, capacity) => {
    const nextCapacity = Number(capacity);
    const currentLength = Number(list?.__tuffArrayListLength ?? 0);
    const nextLength =
      currentLength > nextCapacity ? nextCapacity : currentLength;
    const nextData = Array.isArray(list?.data)
      ? list.data.slice(0, nextCapacity)
      : [];

    while (nextData.length < nextCapacity) {
      nextData.push(0);
    }

    return createList(nextCapacity, nextData, nextLength);
  },
  free: () => undefined,
  listLength: (list) => Number(list?.__tuffArrayListLength ?? 0),
  listCapacity: (list) =>
    Number(list?.__tuffArrayListCapacity ?? list?.length ?? 0),
  setListLength: (list, length) => {
    if (list) {
      list.__tuffArrayListLength = Number(length);
    }
  },
};
