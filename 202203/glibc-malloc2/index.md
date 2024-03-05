# glibc-malloc源码阅读二


在[上一篇](/202203/glibc-malloc/)中，存留了一些疑问:

<!--more-->


1. tcache
2. fastbin
3. smallbin
4. unsorted_bin
5. 以上如何管理？
6. 以上什么关系？
7. bin是怎么初始化的？
8. bin是怎么扩充的，可以扩充吗？


## bin

### malloc_chunk

首先要清楚`bin`中的元素是什么, `bin`中的元素是`memory chunk`, 其定义如下:
```C
struct malloc_chunk {
  INTERNAL_SIZE_T      mchunk_prev_size;  /* Size of previous chunk (if free).  */
  INTERNAL_SIZE_T      mchunk_size;       /* Size in bytes, including overhead. */
  struct malloc_chunk* fd;         /* double links -- used only if free. */
  struct malloc_chunk* bk;
  /* Only used for large blocks: pointer to next larger size.  */
  struct malloc_chunk* fd_nextsize; /* double links -- used only if free. */
  struct malloc_chunk* bk_nextsize;
};
```

- `mchunk_prev_size`代表上一个chunk的大小
- `mchunk_size` 代表当前chunk的大小
- `fd`/`bk`双向链表的前后指针
- `fd_nextsize`/`bk_nextsize`针对large chunk, 双向链表的前后指针

通过`chunk`的结构我们可以知道, `chunk`是通过链表链接起来的, 至于是单向链表还是双向链表就需要再看实现了.

注意到注释部分, 有些成员会标注是"if free", 表示这一项在`chunk`是`free`的时候才有效, 比如`malloc`之后, 这一项就是无效的, 这是用来复用的. `malloc`返回给用户的内存可以访问到这些区域, 比如`mchunk_prev_size`/`fd_nextsize`等, 但是诸如`mchunk_size`这块内存是不允许用户访问的(用户要是访问了, 修改了, 那glibc就无法正常管理了).

#### chunk结构

[malloc.c](https://code.woboq.org/userspace/glibc/malloc/malloc.c.html#malloc_chunk)中对于此内存结构有如下表示:
```
    chunk-> +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
            |             Size of previous chunk, if unallocated (P clear)  |
            +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
            |             Size of chunk, in bytes                     |A|M|P|
      mem-> +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
            |             User data starts here...                          .
            .                                                               .
            .             (malloc_usable_size() bytes)                      .
            .                                                               |
nextchunk-> +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
            |             (size of chunk, but used for application data)    |
            +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
            |             Size of next chunk, in bytes                |A|0|1|
            +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
```

通过这个图, 又可以了解到一些信息:

1. 当前`chunk`加上`mchunk_size`则可以得到下一个`chunk`
2. 当前`chunk`减去`mchunk_prev_size`则可以得到上一个`chunk`
3. `mchunk_prev_size`是可能被上一个`chunk`返回给用户的
4. `fd`及一下等, 是可能被当前`chunk`返回给用户的

`A|M|P`是什么:

1. `A`代表`NON_MAIN_ARENA`, 表示`chunk`的`arena`是不是`main_arena`, 如果是`main_arena`, 则`A = 0`, 否则`A = 1`
2. `M`代表`IS_MMAPPED`, 表示当前`chunk`是不是通过`mmap`申请的
3. `P`代表`PREV_INUSE`, 表示当前`chunk`的上一个`chunk`是不是被使用的, 如果是, 则上一个被使用, `mchunk_prev_size`也无效, 否则`mchunk_prev_size`代表上一个`chunk`的`size`, 第一个`chunk`节点的`P`总是`1`

等等!!上文说的上一个`chunk`是指? 链表的上一个吗? 可以参考[这篇](https://www.jianshu.com/p/2fedeacfa797), 所以我理解的上一个`chunk`是指连续内存上的上一个`chunk`, 因为bin中的`chunk`可能不在相邻内存. 如图示:

!["bin-chunk"](https://bu.dusays.com/2022/06/26/62b87a94bbe46.png "bin-chunk")

### malloc_state

再看看`bin`是什么, 在上一篇的内容中, 我们有提到一个参数`av`, `bin`被存放在`av`中, `av`是一个`malloc_state`指针, `malloc_state`的内容如下:

```C
struct malloc_state
{
  /* Serialize access.  */
  __libc_lock_define (, mutex);
  /* Flags (formerly in max_fast).  */
  int flags;
  /* Set if the fastbin chunks contain recently inserted free blocks.  */
  /* Note this is a bool but not all targets support atomics on booleans.  */
  int have_fastchunks;
  /* Fastbins */
  mfastbinptr fastbinsY[NFASTBINS];
  /* Base of the topmost chunk -- not otherwise kept in a bin */
  mchunkptr top;
  /* The remainder from the most recent split of a small request */
  mchunkptr last_remainder;
  /* Normal bins packed as described above */
  mchunkptr bins[NBINS * 2 - 2];
  /* Bitmap of bins */
  unsigned int binmap[BINMAPSIZE];
  /* Linked list */
  struct malloc_state *next;
  /* Linked list for free arenas.  Access to this field is serialized
     by free_list_lock in arena.c.  */
  struct malloc_state *next_free;
  /* Number of threads attached to this arena.  0 if the arena is on
     the free list.  Access to this field is serialized by
     free_list_lock in arena.c.  */
  INTERNAL_SIZE_T attached_threads;
  /* Memory allocated from the system in this arena.  */
  INTERNAL_SIZE_T system_mem;
  INTERNAL_SIZE_T max_system_mem;
};
```

类型`mfastbinptr`和`mchunkptr`都是`malloc_chunk`的指针, 在`malloc_state`中, 我们可以看到有`fastbin`和`bin`, 以及表示`fastbin`是否存在的`have_fastchunks`, 但是没有看到`smallbin/largebin`这些结构. 实际上, `smallbin/largebin`是包含在`bin`中的. 我的理解是, `smallbin`和`largebin`其实可以看作是同一种`bin`, 所以归类在一起, 但是`fastbin`和其他`bin`会有一些区别, 所以不算在普通`bin`类.

另外还注意到`next`和`next_free`两个成员, 由此也可以推断出`malloc_state`是某个链表的元素, 并且会有类似`free list`的存在.

这里可以看到`main_arena`的初始化, 它的`next`指向了自己, 是一个环状链表的结构:
```C
/* There are several instances of this struct ("arenas") in this
   malloc.  If you are adapting this malloc in a way that does NOT use
   a static or mmapped malloc_state, you MUST explicitly zero-fill it
   before using. This malloc relies on the property that malloc_state
   is initialized to all zeroes (as is true of C statics).  */
static struct malloc_state main_arena =
{
  .mutex = _LIBC_LOCK_INITIALIZER,
  .next = &main_arena,
  .attached_threads = 1
};
```

#### arena的扩展

`arena`如何扩展? 在`malloc`里面我们已经见过`arena_get`函数, 如下:

```C
#define arena_get(ptr, size) do { \
      ptr = thread_arena;                                                      \
      arena_lock (ptr, size);                                                      \
  } while (0)

#define arena_lock(ptr, size) do {                                              \
      if (ptr)                                                                      \
        __libc_lock_lock (ptr->mutex);                                              \
      else                                                                      \
        ptr = arena_get2 ((size), NULL);                                      \
  } while (0)
```

首先是获取当前线程的`thread_arena`, 如果没有, 那么尝试`arena_get2`. `thread_arena`是什么? 在`ptmalloc_init`填充了`thread_arena`, 指向了`main_arena`:

```C
//ptmalloc_init (void)
thread_arena = &main_arena;
```

但是我们还需要注意, `__malloc_hook`只有在第一次调用`malloc`的时候才会被调用, 此后`__malloc_hook`会被赋空, 也就是说对应的`ptmalloc_init`只会被调用一次, 只有在进程启动的时候, 第一个线程的`thread_arena`才会被赋值为`&main_arena`, 而其他线程此值为空.

在`malloc`的时候, 还有这么一段:
```C
if (SINGLE_THREAD_P)
{
  victim = _int_malloc (&main_arena, bytes);
  assert (!victim || chunk_is_mmapped (mem2chunk (victim)) ||
          &main_arena == arena_for_chunk (mem2chunk (victim)));
  return victim;
}
```
这说明, 在单线程环境的时候, 直接使用`main_arena`就行了, 多线程环境, 不同的线程则可能使用不同的`arena`, 这是为了加速, 减少互斥锁而使用的.

再继续`arena_get2`, 它做的第一件事就是尝试从一个`free`的链表中获取, 如果获取到了, 那就返回了, 如果没获取到, 则尝试创建一个新的`arena`:

```C
a = get_free_list ();
if (a == NULL)
{
  //......
  a = _int_new_arena (size);
  //......
  a = reused_arena (avoid_arena);
  //......
}
```

当然, 是不是可以无限制的创建`arena`? 不是的, 会和当前系统有关. `_int_new_arena`的作用就本就是`mmap`一块`heap`, 然后改造成`arena`结构, 再将`thread_arena`指向这块新`arena`, 原先的`arena`则会被`detach`掉(`detach`的作用就是当前`arena`的引用计数器`attached_threads`减一), 但是目前还没有回收到`free`表中:

```C
mstate replaced_arena = thread_arena;
thread_arena = a;
//......
__libc_lock_lock (free_list_lock);
detach_arena (replaced_arena);
__libc_lock_unlock (free_list_lock);
```

新`arena`怎么和`arena`链表关联起来呢? 如下, 新`arena`总是插在链表的"颈部", 而链表"尾部"的元素总是指向"头部"的`main_arena`. 所以, 这类似于一个`FIFO`的队列:

```C
/* Add the new arena to the global list.  */
a->next = main_arena.next;
/* FIXME: The barrier is an attempt to synchronize with read access
    in reused_arena, which does not acquire list_lock while
    traversing the list.  */
atomic_write_barrier ();
main_arena.next = a;
```

#### arena的复用

或者, 如果没办法创建新的`arena`了(和系统有关), 那么就会考虑复用, 调用`reused_arena`, 大致流程是:

获取`arena`链表头部节点:
```C
/* FIXME: Access to next_to_use suffers from data races.  */
static mstate next_to_use;
if (next_to_use == NULL)
  next_to_use = &main_arena;
```

移动到尾部节点:
```C
/* Iterate over all arenas (including those linked from
    free_list).  */
result = next_to_use;
do
  {
    if (!__libc_lock_trylock (result->mutex))
      goto out;
    /* FIXME: This is a data race, see _int_new_arena.  */
    result = result->next;
  }
while (result != next_to_use);
```

将尾部节点从`free list`中移除, 如果`free list`中有这个元素的话. 然后在对对应的`arena`计数器加一:
```C
/* Attach the arena to the current thread.  */
{
  /* Update the arena thread attachment counters.   */
  mstate replaced_arena = thread_arena;
  __libc_lock_lock (free_list_lock);
  detach_arena (replaced_arena);
  /* We may have picked up an arena on the free list.  We need to
      preserve the invariant that no arena on the free list has a
      positive attached_threads counter (otherwise,
      arena_thread_freeres cannot use the counter to determine if the
      arena needs to be put on the free list).  We unconditionally
      remove the selected arena from the free list.  The caller of
      reused_arena checked the free list and observed it to be empty,
      so the list is very short.  */
  remove_from_free_list (result);
  ++result->attached_threads;
  __libc_lock_unlock (free_list_lock);
}
```

将当前线程的`arena`设置为上述找到的尾节点的`arena`:
```C
LIBC_PROBE (memory_arena_reuse, 2, result, avoid_arena);
thread_arena = result;
next_to_use = result->next;
```

以上, 就可以复用过去的某个`arena`了, 有几点注意:

1. 每次都是找的最后一个节点? 我认为是因为这是一个`FIFO`队列, 所以尾节点在`free list`的概率比较高, 或者尾节点尽快`free`的概率比较高
2. 如果目标`arena`在`free list`, 那正好拿来用, 无需考虑竞争
3. 如果目标`arena`不在`free list`呢? 这时候就是真的复用了, 多线程环境则可能存在阻塞
4. 计数器`attached_threads`在调用`free`的时候有用, 只有没有消费者了, 才允许塞入`free list`
5. 所有`arena`都被塞入了一个环形链表, `free arena`再有一个`free`链表维护

#### free arena

`free`链表则在线程退出的时候会被填充, 线程退出时, 如果其`arena`的引用计数为0, 则会交还其`arena`到进程的`free list`, 因此, 如果有其他线程需要使用, 并且`free list`中的元素满足要求时, 就不再需要重新`mmap`了(回到上面的`get_free_list`):

```C
void
__malloc_arena_thread_freeres (void)
{
  /* Shut down the thread cache first.  This could deallocate data for
     the thread arena, so do this before we put the arena on the free
     list.  */
  tcache_thread_shutdown ();
  mstate a = thread_arena;
  thread_arena = NULL;
  if (a != NULL)
    {
      __libc_lock_lock (free_list_lock);
      /* If this was the last attached thread for this arena, put the
         arena on the free list.  */
      assert (a->attached_threads > 0);
      if (--a->attached_threads == 0)
        {
          a->next_free = free_list;
          free_list = a;
        }
      __libc_lock_unlock (free_list_lock);
    }
}
```

#### 小结

以上:

1. 一个线程的`malloc`维护了一个`arena`
2. `arena`中维护了多个`bin`
3. `bin`是链表结构
4. `bin`的元素是`chunk`
5. `chunk`会考虑内存复用, 尽可能节约内存
6. `malloc_state(arena)`是某个环形链表结构的元素
7. 所有`arena`被一个链表维护(无论`busy`或`free`), 此外会有`free`链表维护`free`的`arena`
8. 新`arena`插在链表头部
9. 线程退出时会交还其`arena`到进程的`free list`中
10. 如果不允许创建新的`arena`则会复用尾节点的`arena`

### fastbin

先来看`free`是怎么工作的:

一下是`free`的一部分, 如果是`mmap`的内存, 那么`unmmap`就好了:
```C
p = mem2chunk (mem);
if (chunk_is_mmapped (p))                       /* release mmapped memory. */
{
  /* See if the dynamic brk/mmap threshold needs adjusting.
      Dumped fake mmapped chunks do not affect the threshold.  */
  if (!mp_.no_dyn_threshold
      && chunksize_nomask (p) > mp_.mmap_threshold
      && chunksize_nomask (p) <= DEFAULT_MMAP_THRESHOLD_MAX
      && !DUMPED_MAIN_ARENA_CHUNK (p))
    {
      mp_.mmap_threshold = chunksize (p);
      mp_.trim_threshold = 2 * mp_.mmap_threshold;
      LIBC_PROBE (memory_mallopt_free_dyn_thresholds, 2,
                  mp_.mmap_threshold, mp_.trim_threshold);
    }
  munmap_chunk (p);
  return;
}
```

如果不是`mmap`的内存, 而是从`malloc_state`获取的:
```C
ar_ptr = arena_for_chunk (p);
_int_free (ar_ptr, p, 0);
```

现在走到`_int_free`里面:

```C
if ((unsigned long)(size) <= (unsigned long)(get_max_fast ())
{
  //...
  unsigned int idx = fastbin_index(size);
  fb = &fastbin (av, idx);
  /* Atomically link P to its fastbin: P->FD = *FB; *FB = P;  */
  mchunkptr old = *fb, old2;
  //...
  p->fd = old2 = old;
  //...
}
```

如果当前`chunk`的`size`小于`fastbin`的最大`size`, 那么就需要塞入到`fastbin`. 先根据`size`找到对应的`fastbin`, 然后把当前`chunk`塞入到头节点即可. 这里可以得到关于`fastbin`的几个信息:

1. `fastbin`是单向链表
2. `fastbin`中每个`bin`中的`chunk`大小相等
3. `fastbin`对应小内存

### unsorted_bin

跟着`_int_free`继续走, 如果需要释放的chunk比fastbin的最大大小还要大, 则会尝试合并:
```C
else if (!chunk_is_mmapped(p)) {
  //...

  // 获取下一个chunk
  nextchunk = chunk_at_offset(p, size);

  // 拿到下一个chunk的size
  nextsize = chunksize(nextchunk);

  /* consolidate backward */
  // 如果上一个chunk可被访问, 合并上一个chunk到当前chunk
  if (!prev_inuse(p)) {
    // 获取上一个chunk的大小
    prevsize = prev_size (p);

    // 扩充当前chunk的size
    size += prevsize;

    // 获取上一个chunk的位置
    p = chunk_at_offset(p, -((long) prevsize));
    if (__glibc_unlikely (chunksize(p) != prevsize))
      malloc_printerr ("corrupted size vs. prev_size while consolidating");

    // 将上一个chunk从arena中移除(因为被合并到当前chunk了)
    unlink_chunk (av, p);
  }
  //...

  // 下一个chunk同理, 但是需要考虑是不是在top, 以下假设下一个chunk也合并了

  // 合并后的chunk插入到unsorted_bin的头部
  bck = unsorted_chunks(av);
  fwd = bck->fd;
  if (__glibc_unlikely (fwd->bk != bck))
    malloc_printerr ("free(): corrupted unsorted chunks");
  p->fd = fwd;
  p->bk = bck;
  if (!in_smallbin_range(size))
    {
      p->fd_nextsize = NULL;
      p->bk_nextsize = NULL;
    }
  bck->fd = p;
  fwd->bk = p;

  // 设置新chunk的size
  set_head(p, size | PREV_INUSE);
  set_foot(p, size);
}
```

现在可以知道了, `unsorted_bin`在调用`free`的时候可能会被扩充, 同时, 可能会将待`free`的`chunk`的上一个和下一个合并成一个大的`chunk`, 一起塞入`unsorted_bin`. 并且`unsorted_bin`是一个双向链表, 且只有一个.

但是, 如果上述假设的"下一个chunk也合并"不成立, 那么就不会将合并后的`chunk`(当前和上一个)塞入`unsorted_bin`, 因为`top`是比较特殊的结构, 详细见[源码](https://code.woboq.org/userspace/glibc/malloc/malloc.c.html#_int_free).

如果合并后的`chunk`太大了, 这时候就可以怀疑可能存在较大的内存碎片, 这时候就需要尝试释放部分内存了, 首先就是判断合并后的大小是否大过阈值, 以减少系统调用的次数, 如果大于阈值, 那么先把`fastbin`合并了.

为什么要合并`fastbin`才能缩减内存? 我的理解是: `free`之后, 内存要不就放到了`fastbin`, 要不就是`unsorted_bin`(`unmmap`的就不在考虑范围了), 假设要缩减内存, 那么也就只能在这两个`bin`中, 另外, 如果要缩减, 那也只能从堆的头部开始缩减, 但是又没法知道包含头部内存区域的`chunk`在哪个`bin`中, 又不可能在这时候合并所有的`bin`(比如把`unsorted_bin`也给合并成一个, 但是这样效率太低), 所以退而求其次, 先合并`fastbin`, 以增大扩充`top chunk`的可能性, 以达到尽可能缩减更大堆的目的.

```C
if ((unsigned long)(size) >= FASTBIN_CONSOLIDATION_THRESHOLD) {
  if (atomic_load_relaxed (&av->have_fastchunks))
    malloc_consolidate(av);
//......
```

之后调用`systrim(mp_.top_pad, av);`或`heap_trim(heap, mp_.top_pad);`来缩减堆.

### smallbin和largebin

现在回过去看`_int_malloc`就比较容易理解了, 我们跳过从`fastbin`或者`smallbin`或者`largebin`中拿`chunk`的部分, 如果上面说的几个`bin`中没有`chunk`怎么办? 那就从`unsorted_bin`中找.(对应[上一篇](/202203/glibc-malloc/)未完成的第四部分)

先是判断`unsorted_bin`中是不是有`chunk`:
```C
while ((victim = unsorted_chunks (av)->bk) != unsorted_chunks (av))
```

然后拿到`unsorted_bin`的最后一个`chunk`和倒数第二个`chunk`:
```C
// bck表示上一个chunk
bck = victim->bk;
size = chunksize (victim);
mchunkptr next = chunk_at_offset (victim, size);
```

如果`unsorted_bin`只有一个`chunk`(就没必要查找了), 并且当前需求的是一个`small chunk`, 并且需求的大小比这个`chunk`的大小还小一些, 那么就裁剪这个`chunk`, 然后放回需要的部分:
```C
// 检查大小以及unsorted_bin中chunk是不是只有一个
if (in_smallbin_range (nb) &&
    // 判断unsorted_chunks中只有一个chunk
    bck == unsorted_chunks (av) &&
    victim == av->last_remainder &&
    (unsigned long) (size) > (unsigned long) (nb + MINSIZE))
{
  /* split and reattach remainder */
  // 只分配需要的大小
  remainder_size = size - nb;

  // 多余的部分继续塞在unsorted_chunks
  remainder = chunk_at_offset (victim, nb);
  unsorted_chunks (av)->bk = unsorted_chunks (av)->fd = remainder;
  av->last_remainder = remainder;
  remainder->bk = remainder->fd = unsorted_chunks (av);
  if (!in_smallbin_range (remainder_size))
    {
      remainder->fd_nextsize = NULL;
      remainder->bk_nextsize = NULL;
    }

  // 设置chunk信息
  set_head (victim, nb | PREV_INUSE |
            (av != &main_arena ? NON_MAIN_ARENA : 0));
  set_head (remainder, remainder_size | PREV_INUSE);
  set_foot (remainder, remainder_size);
  check_malloced_chunk (av, victim, nb);
  void *p = chunk2mem (victim);
  alloc_perturb (p, bytes);
  return p;
}
```

不过, 这里还是没有`smallbin`什么事, 下次`free`的时候, 这个`chunk`又被还给`unsorted_bin`了. 继续往下看:

如果上面的不满足, 那先把这个`chunk`从`unsorted_bin`拿出来:
```C
unsorted_chunks (av)->bk = bck;
bck->fd = unsorted_chunks (av);
```

如果大小正好满足, 那直接返回, 否则:

如果`chunk`的`size`在`smallbin`的范围, 那先找到`smallbin`对应大小`chunk`的位置(`largebin`类似):
```C
if (in_smallbin_range (size))
  {
    victim_index = smallbin_index (size);
    bck = bin_at (av, victim_index);
    fwd = bck->fd;
  }
else
  {
    //...
    //largebin的塞入位置是有序的, 会判断当前chunk的size而返回不同的插入部位
    //总之, 这一步之后, largebin会变得有序
  }
```

然后把当前`chunk`塞进去:
```C
mark_bin (av, victim_index);
victim->bk = bck;
victim->fd = fwd;
fwd->bk = victim;
bck->fd = victim;
```

但是现在并不会立即退出上文说的`while`循环, 而是直到达到最大的循环次数或者`unsorted_bin`中找到了需求的元素(只有一个`chunk`且大小满足或者大小刚好合适)或者`unsorted_bin`的所有元素都被塞入了`smallbin`或者`largebin`:
```C
#define MAX_ITERS       10000
if (++iters >= MAX_ITERS)
  break;
```

以上, 假设没从`unsorted_bin`中找到合适的目标, 那么这时候`unsorted_bin`中所有的`chunk`都被填入了`smallbin`或者`largebin`了. 现在开始从这两个`bin`中查找:

首先是`largebin`:
```C
if (!in_smallbin_range (nb))
  {
    /* skip scan if empty or largest chunk is too small */
    if ((victim = first (bin)) != bin
        && (unsigned long) chunksize_nomask (victim)
          >= (unsigned long) (nb))
      {
        victim = victim->bk_nextsize;
        while (((unsigned long) (size = chunksize (victim)) <
                (unsigned long) (nb)))
          victim = victim->bk_nextsize;
        //...

        if (remainder_size < MINSIZE)
          {
            //...
          }
        /* Split */
        else
          {
            //...
          }
        //...
      }
  }
```

不需要过多关注查找逻辑, 以上表达的是, 从`largebin`中找`chunk`, 是需要找最小的适合大小, 如果最终找到的目标还是太大了, 那么会裁剪, 多余的部分放在`remainder`表中, 这部分逻辑与上文是类似的.

如果上部分还是没有找到, 那么就一个一个遍历后续的`bin`(因为`bin`是按照大小排序的, 这部分代码省略), 先找到有`chunk`的`bin`, 然后找满足`chunk`大小的目标, 类似上述逻辑, 如果没有大很多, 则直接返回, 如果大很多, 那么先裁切, 多余部分串在`remainder`表中. 这部分逻辑就不继续追究了.

如果还是没找到!!! 那么尝试使用`top`的内存(堆顶内存), 如果`top`内存满足, 同样是裁切然后返回, 如果不满足, 那么检查是否可以合并`fastbin`, 如果可以合并, 那么就合并, 再继续查找(回到`unsorted_bin`, 再重复上述逻辑), 如果没有`fastbin`, 那么就扩展当前`arena`, 然后直接返回一个`chunk`, 如下:

```C
victim = av->top;
size = chunksize (victim);
if (__glibc_unlikely (size > av->system_mem))
  malloc_printerr ("malloc(): corrupted top size");
if ((unsigned long) (size) >= (unsigned long) (nb + MINSIZE))
  {
    remainder_size = size - nb;
    remainder = chunk_at_offset (victim, nb);
    av->top = remainder;
    set_head (victim, nb | PREV_INUSE |
              (av != &main_arena ? NON_MAIN_ARENA : 0));
    set_head (remainder, remainder_size | PREV_INUSE);
    check_malloced_chunk (av, victim, nb);
    void *p = chunk2mem (victim);
    alloc_perturb (p, bytes);
    return p;
  }
/* When we are using atomic ops to free fast chunks we can get
    here for all block sizes.  */
else if (atomic_load_relaxed (&av->have_fastchunks))
  {
    malloc_consolidate (av);
    /* restore original bin index */
    if (in_smallbin_range (nb))
      idx = smallbin_index (nb);
    else
      idx = largebin_index (nb);
  }
/*
    Otherwise, relay to handle system-dependent cases
  */
else
  {
    void *p = sysmalloc (nb, av);
    if (p != NULL)
      alloc_perturb (p, bytes);
    return p;
  }
```

`sysmalloc`用来`sbrk`或者`mmap`内存, 上一篇中有提到过.

#### 小结

以上:

1. `smallbin`和`largebin`类似, 都是双链表结构, 用来存储`fastbin`以外的比较大的`chunk`
2. `smallbin`中的`chunk`不保证顺序
3. `largebin`中的`chunk`保证大小顺序
4. `unsorted_bin`中的`chunk`可能会被转移到`smallbin`或`largebin`中
5. `chunk`可以合并, 也可以裁切
6. 如果`bin`中的`chunk`不满足需求, 则可能通过`top`分配`chunk`
7. 如果`top`的内存也不满足需求, 则`malloc`的时候也可能尝试合并`fastbin`
8. 如果`fastbin`也不满足需求, 那么会尝试扩展`arena`

### tcache

略.(TODO:待补充)

### 总结

先来回答最开始的问题:

1. tcache: 略
2. fastbin: 单向链表, 存放小内存, 每个bin中的size相同, free的时候小内存直接还给fastbin, malloc的时候小内存也可以从fastbin获取
3. smallbin: 双向链表, 存放介于fastbin和largebin大小之间的内存, bin有大小顺序, bin中的chunk没有大小顺序, 可以通过unsorted_bin扩充；largebin同smallbin, 但是每个bin的chunks也是有大小序的
4. unsorted_bin: 类似回收机制, free的时候比fastbin大的chunk(mmap极大chunk除外)会被放到unsorted_bin, 并且这个chunk可能会与上一个和下一个合并后再加入unsorted_bin, fastbin在某个阈值之后也会被合并加入到unsorted_bin
5. 以上如何管理？ 我的理解是fastbin/smallbin/largebin用于获取内存(unsorted_bin也有概率直接返回给用户内存), fastbin/unsorted_bin用于回收内存, 但是如果发现回收内存太大时, 则可能会通过trim缩减内存
6. 以上什么关系？ 同上
7. bin是怎么初始化的？ 首先, arena的初始化也伴随着bin的初始化, 所以进程/线程初次调用malloc的时候, 就会初始化bin了, 如果各种bin(或者说arena)不满足需求了, 则还会通过sysmalloc扩充bin(或arena)
8. bin是怎么扩充的，可以扩充吗？ 同上, 但是bin的数量是固定的, bin中的chunk的数量未见有限制

`malloc`的一般故事流程是(要说清楚每一个case的话, 太复杂了, 所以以下是**我认为比较通常**的情况):

1. 启动进程, 调用malloc
2. malloc init, 初始化main arena
3. 通过各种bin没有找到需要的chunk, 扩充bin, 返回一个chunk
4. 调用free
5. 回收内存, 如果是很小的内存, 则暂存在fastbin, 如果是比较大的内存, 则与相邻内存合并后放入unsorted_bin
6. 再调用malloc
7. 如果发现fastbin符合要求, 则直接返回fastbin的内存
8. 如果发现smallbin/largebin符合要求, 则返回对应内存
9. 如果以上都不满足, 则从unsorted_bin中将内存搬运到smallbin/largebin后, 再从这两个bin中查找
10. 重复以上步骤4~9, 发现回收的内存很大, 则尝试缩减内存
11. 启动了一个新的线程
12. 从free list尝试获取一个arena, 如果没法获取, 创建一个新的arena, 线程独立使用, 所以几乎无需担心竞争
13. 如果不允许创建新的arena了, 则尝试复用"最老"的一个arena, 需要当心竞争, 所以会阻塞
14. 线程退出, 检查对应的arena, 如果计数器为0了, 那么将对应arena加入free list


