# glibc-malloc源码阅读


在[上一篇](/202202/glibc-mmap/)中，我们了解到了`mmap`的一些性质和基本原理：

<!--more-->

1. 分配的是虚拟内存
2. 通过红黑树找到目标内存块，并且通过红黑树管理
3. 分配的内存可能比实际需要的大
4. 是阻塞的
5. 会有内存对齐


本篇将了解到`malloc`和`mmap`的关系，以及解答我在`mmap`学习中产生的一个疑问：`mmap`会不会导致内存碎片？（因为`mmap`的内存看起来是被内核维护的红黑树管理了，所以我理解不会存在内存碎片。）

## 概述

以下是[malloc.c](https://code.woboq.org/userspace/glibc/malloc/malloc.c.html)中关于`malloc`的一小段概述：

```
  The main properties of the algorithms are:
  * For large (>= 512 bytes) requests, it is a pure best-fit allocator,
    with ties normally decided via FIFO (i.e. least recently used).
  * For small (<= 64 bytes by default) requests, it is a caching
    allocator, that maintains pools of quickly recycled chunks.
  * In between, and for combinations of large and small requests, it does
    the best it can trying to meet both goals at once.
  * For very large requests (>= 128KB by default), it relies on system
    memory mapping facilities, if supported.
```

有些地方可能不理解，先看代码吧～

## __libc_malloc

```C
void *
__libc_malloc (size_t bytes)
{
  mstate ar_ptr;
  void *victim;
  void *(*hook) (size_t, const void *)
    = atomic_forced_read (__malloc_hook);
  if (__builtin_expect (hook != NULL, 0))
    return (*hook)(bytes, RETURN_ADDRESS (0));
#if USE_TCACHE
  /* int_free also calls request2size, be careful to not pad twice.  */
  size_t tbytes;
  checked_request2size (bytes, tbytes);
  size_t tc_idx = csize2tidx (tbytes);
  MAYBE_INIT_TCACHE ();
  DIAG_PUSH_NEEDS_COMMENT;
  if (tc_idx < mp_.tcache_bins
      /*&& tc_idx < TCACHE_MAX_BINS*/ /* to appease gcc */
      && tcache
      && tcache->entries[tc_idx] != NULL)
    {
      return tcache_get (tc_idx);
    }
  DIAG_POP_NEEDS_COMMENT;
#endif
  if (SINGLE_THREAD_P)
    {
      victim = _int_malloc (&main_arena, bytes);
      assert (!victim || chunk_is_mmapped (mem2chunk (victim)) ||
              &main_arena == arena_for_chunk (mem2chunk (victim)));
      return victim;
    }
  arena_get (ar_ptr, bytes);
  victim = _int_malloc (ar_ptr, bytes);
  /* Retry with another arena only if we were able to find a usable arena
     before.  */
  if (!victim && ar_ptr != NULL)
    {
      LIBC_PROBE (memory_malloc_retry, 1, bytes);
      ar_ptr = arena_get_retry (ar_ptr, bytes);
      victim = _int_malloc (ar_ptr, bytes);
    }
  if (ar_ptr != NULL)
    __libc_lock_unlock (ar_ptr->mutex);
  assert (!victim || chunk_is_mmapped (mem2chunk (victim)) ||
          ar_ptr == arena_for_chunk (mem2chunk (victim)));
  return victim;
}
```

### hook

以上第一段是调用`hook`函数，也就是说`malloc`默认是提供`hook`接口的，只要实现了`hook`接口，`malloc`就可以变成对应的`hook`函数。
```C
  void *(*hook) (size_t, const void *)
    = atomic_forced_read (__malloc_hook);
  if (__builtin_expect (hook != NULL, 0))
    return (*hook)(bytes, RETURN_ADDRESS (0));
```

`__malloc_hook`的默认值是指向的`malloc_hook_ini`，如下，`malloc_hook_ini`会给`__malloc_hook`赋空，所以`malloc_hook_ini`可以相当于就是`__libc_malloc`：

```C
static void *
malloc_hook_ini (size_t sz, const void *caller)
{
  __malloc_hook = NULL;
  ptmalloc_init ();
  return __libc_malloc (sz);
}
```

### tcache

第二部分是`tcache`，暂且不用过分追究（因为内容比较多，虽然目前`malloc`可能依赖于`tcache`，但是即使不学习`tcache`也不太影响对`malloc`的理解）：

```C
#if USE_TCACHE
  /* int_free also calls request2size, be careful to not pad twice.  */
  size_t tbytes;
  checked_request2size (bytes, tbytes);
  size_t tc_idx = csize2tidx (tbytes);
  MAYBE_INIT_TCACHE ();
  DIAG_PUSH_NEEDS_COMMENT;
  if (tc_idx < mp_.tcache_bins
      /*&& tc_idx < TCACHE_MAX_BINS*/ /* to appease gcc */
      && tcache
      && tcache->entries[tc_idx] != NULL)
    {
      return tcache_get (tc_idx);
    }
  DIAG_POP_NEEDS_COMMENT;
#endif
```

两个宏如下：

```C
#define request2size(req)                                         \
  (((req) + SIZE_SZ + MALLOC_ALIGN_MASK < MINSIZE)  ?             \
   MINSIZE :                                                      \
   ((req) + SIZE_SZ + MALLOC_ALIGN_MASK) & ~MALLOC_ALIGN_MASK)

#define checked_request2size(req, sz) \
({                                    \
  (sz) = request2size (req);            \
  if (((sz) < (req))                    \
      || REQUEST_OUT_OF_RANGE (sz)) \
    {                                    \
      __set_errno (ENOMEM);            \
      return 0;                            \
    }                                    \
})
```

如上，先是内存对齐，得到`tbytes`，然后根据`tbytes`计算出来一个下标`tc_idx`，然后就可以根据下标去`tcache`里面找了。

`tcache`的基本定义如下：

```C
/* We overlay this structure on the user-data portion of a chunk when
   the chunk is stored in the per-thread cache.  */
typedef struct tcache_entry
{
  struct tcache_entry *next;
  /* This field exists to detect double frees.  */
  struct tcache_perthread_struct *key;
} tcache_entry;
/* There is one of these for each thread, which contains the
   per-thread cache (hence "tcache_perthread_struct").  Keeping
   overall size low is mildly important.  Note that COUNTS and ENTRIES
   are redundant (we could have just counted the linked list each
   time), this is for performance reasons.  */
typedef struct tcache_perthread_struct
{
  char counts[TCACHE_MAX_BINS];
  tcache_entry *entries[TCACHE_MAX_BINS];
} tcache_perthread_struct;
static __thread bool tcache_shutting_down = false;
static __thread tcache_perthread_struct *tcache = NULL;
```

可以知道几点：

1. `tcache`是每个线程维护的
2. `tcache`是一个链表结构

在`malloc`中，通过`tcache_get`接口从`tcache`中获取了一块buffer，实现如下：

```C
/* Caller must ensure that we know tc_idx is valid and there's
   available chunks to remove.  */
static __always_inline void *
tcache_get (size_t tc_idx)
{
  tcache_entry *e = tcache->entries[tc_idx];
  assert (tc_idx < TCACHE_MAX_BINS);
  assert (tcache->counts[tc_idx] > 0);
  tcache->entries[tc_idx] = e->next;
  --(tcache->counts[tc_idx]);
  e->key = NULL;
  return (void *) e;
}
```

大概意思是，拿`tcache`的第`tc_idx`个作为输出，然后将原本第`tc_idx`的`entry`指向当前需要输出的`entry`的下一个，这意味着`tcache`里面不同的`entry`也可能指向同一个，然后再把对应的第`tc_idx`的`count--`。

再看一下和`get`对应的`put`操作：
```C
/* Caller must ensure that we know tc_idx is valid and there's room
   for more chunks.  */
static __always_inline void
tcache_put (mchunkptr chunk, size_t tc_idx)
{
  tcache_entry *e = (tcache_entry *) chunk2mem (chunk);
  assert (tc_idx < TCACHE_MAX_BINS);
  /* Mark this chunk as "in the tcache" so the test in _int_free will
     detect a double free.  */
  e->key = tcache;
  e->next = tcache->entries[tc_idx];
  tcache->entries[tc_idx] = e;
  ++(tcache->counts[tc_idx]);
}
```

恩！可以和`get`对应起来了，`get`的时候第`tc_idx`的`entry`被指向了下一个，在`put`的时候就可以记住下一个的位置，然后`put`的时候将`tc_idx`指回去就行了，所以链表又恢复到了原状。

这里有个疑问：`entry`的状态是怎么记录的？比如`get`的时候发送一个`entry`出去，那么`free`的时候怎么记得这个`buffer`的大小/来源等等之类的呢？可以想到一些类比结构，比如：

1. `task_struct`和`thread_info`的内存关系（[这里](/202105/process-ctracon4#内核栈)）
2. `class`中`type_info`和类的内存关系（[这里](/202107/cpp-class-mem2#问题1-类是怎么指向虚表的)）

实际上，`tcache entry`的“头上”还有一块内存空间，在那里记录了`malloc`内存的一些状态信息。在[这里](https://code.woboq.org/userspace/glibc/malloc/malloc.c.html#malloc_chunk)可以看到详细的内存分布。

以上，我们大概了解到了`malloc`以及`tcache`：

1. `malloc`可以从`tcache`中直接拿到内存
2. `tcache`可以用作缓存内存，也就是内存可以不立即交还给系统
3. `tcache`相当于是一个内存池，并且由每个线程维护
4. `malloc`的内存比实际需要的内存大

以上默认情况是可以从`tcache`中获取内存，如果不可以或者里面没有内存呢？

### _int_malloc

如果上述条件不满足，`__libc_malloc`后续的主要逻辑就是调用`_int_malloc`函数，如下：

```C
arena_get (ar_ptr, bytes);
victim = _int_malloc (ar_ptr, bytes);
```

#### 第一部分

第一部分可能调用`sysmalloc`，其中会使用`mmap`或者`brk`分配内存。只有`av`为空的时候才可能进入这一段，`av`什么时候可能为空？在线程第一次调用`malloc`之前，`av`可能为空。这时候通过系统调用申请一块比较大的内存，然后再执行某种分配，填充到`av`，所以此后，部分内存可以直接通过`av`获取，而不需要频繁执行系统调用了。（`sysmalloc`不是系统调用）

```C
/* There are no usable arenas.  Fall back to sysmalloc to get a chunk from
    mmap.  */
if (__glibc_unlikely (av == NULL))
{
    void *p = sysmalloc (nb, av);
    if (p != NULL)
    alloc_perturb (p, bytes);
    return p;
}
```

#### 第二部分

第二部分代码很多，只看外部的一点：

```C
if ((unsigned long) (nb) <= (unsigned long) (get_max_fast ()))
{
    idx = fastbin_index (nb);
    mfastbinptr *fb = &fastbin (av, idx);
    //...

    void *p = chunk2mem (victim);
    alloc_perturb (p, bytes);
    return p;
    //...
}
```

只有在申请的内存小于`get_max_fast ()`的时候才可能进入。类似的，我们可以看到有`fastbin`这样的结构，和上文中看到的`tcache`一样，会有专门的表维护`fastbin`，并且其中储存的是较小的内存。

从`fastbin`这中拿到内存后，通过`chunk2mem`转换成用户可用的内存（实际上就是往高字节取）。

#### 第三部分

```C
/*
    If a small request, check regular bin.  Since these "smallbins"
    hold one size each, no searching within bins is necessary.
    (For a large request, we need to wait until unsorted chunks are
    processed to find best fit. But for small ones, fits are exact
    anyway, so we can check now, which is faster.)
*/
if (in_smallbin_range (nb))
{
    idx = smallbin_index (nb);
    bin = bin_at (av, idx);
    //......

    void *p = chunk2mem (victim);
    alloc_perturb (p, bytes);
    return p;
    //......
}
/*
    If this is a large request, consolidate fastbins before continuing.
    While it might look excessive to kill all fastbins before
    even seeing if there is space available, this avoids
    fragmentation problems normally associated with fastbins.
    Also, in practice, programs tend to have runs of either small or
    large requests, but less often mixtures, so consolidation is not
    invoked all that often in most programs. And the programs that
    it is called frequently in otherwise tend to fragment.
*/
else
{
    idx = largebin_index (nb);
    if (atomic_load_relaxed (&av->have_fastchunks))
    malloc_consolidate (av);
}
```

同理，如果`fastbin`的大小不满足要求，那么就在`smallbin`里面去找。

如果`smallbin`还不满足要求，那么认为需要一个`large`的内存，这时候会先将`fastbin`中的小内存合并。其目的是减少内存碎片化（`brk`内存容易产生碎片，`mmap`内存不产生碎片，一般情况下只有大内存才会使用`mmap`申请，比如128KB以上）。

合并到哪里呢？看`malloc_consolidate`大概是会合并到一个叫`unsorted_bin`的`bin`里面去。

#### 第四部分

[源码](https://code.woboq.org/userspace/glibc/malloc/malloc.c.html#_int_malloc)

（看不懂了！！！）

遗留问题是（TODO）：

1. tcache
2. fastbin
3. smallbin
4. unsorted_bin
5. 以上如何管理？
6. 以上什么关系？
7. bin是怎么初始化的？
8. bin是怎么扩充的，可以扩充吗？

### 总结

尽管没全部看懂，不过也了解`malloc`的一些事情：

1. `malloc`可以尽可能减少通过系统调用分配内存
2. `malloc`可以尽可能减少内存碎片
3. `malloc`在用户态管理内存（区别于`mmap`的`rb_tree`）
4. `malloc`申请内存可能通过“内存池”直接返回，也有可能会通过系统调用返回，一般取决于需要的内存大小
5. `malloc`可能存在内存合并的过程
6. `malloc`管理的内存数量以及大小是有限的（通过`idx`的计算方式可以推断出）
7. `malloc`管理的内存是按线程区分的，所以多线程情况下不存在阻塞
8. `malloc`分配虚拟内存的时候，实际的会比需求的更多（物理内存也会更多，因为需要有存放状态的内存，这时候是已经缺页中断了）
9. `free`回收内存不一定直接交还给系统，可能会交由`tcache`或者`bin`管理，这是用户态的
