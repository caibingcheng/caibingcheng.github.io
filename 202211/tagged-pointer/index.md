# tagged-pointer-让指针包含更多信息


在C++中，我们可以指定类型在内存中的对齐方式。比如使用` __attribute__((aligned(4)))`，使得使用该类型的变量以4Byte方式对齐。一般讨论内存对齐的作用主要有两点：

<!--more-->

1. 跨平台移植（和硬件相关）
2. 提高CPU访问性能

除此之外还有什么作用，是本文要探索的。提出该问题是源于以下代码：

```C
unsigned long __fdget_pos(unsigned int fd)
{
	unsigned long v = __fdget(fd);
	struct file *file = (struct file *)(v & ~3);
	if (file && (file->f_mode & FMODE_ATOMIC_POS)) {
		if (file_count(file) > 1) {
			v |= FDPUT_POS_UNLOCK;
			mutex_lock(&file->f_pos_lock);
		}
	}
	return v;
}
```

关注以下部分：
```C
unsigned long v = __fdget(fd);
struct file *file = (struct file *)(v & ~3);
```

通过`__fdget(fd)`拿到`struct file`的地址`v`，然后通过`v & ~3`得到真正的`struct file`地址。是不是很**奇怪**？

通过搜索kernel邮件，关于这段代码，查询到了这个关键词 - `tagged pointer`。

`tagged pointer`是苹果提出的概念，用于减少内存占用和提高访问速度等（在OC的`NSNumber`中有使用）。网上有很多人对这个概念做出了翻译/解释，因此不再赘述。对于在C++中的应用，我的理解是：

比如有一个类型`Number`可以存储任意大小的数字，那么设计时一般会在其内部塞入一个ptr指针，指向堆内存，在那里存放了这个数字的信息。对于很大的数字比较好理解，但是对于小数字，比如0~65535之类，还需要在堆内存上分配一块吗？如果对小数字也分配内存，势必有些浪费，那么这时候就可以在上述的ptr指针上做手脚。比如约定ptr指针一定是一个4Byte对齐的指针，这意味着ptr指向的地址一定是`0x???..???00`。现在有两种使用方法：

1. 直接使用低2位，如果低2位不为0，那么低2位代表的数字就是这个小数字；
2. 将低2位作为标志位，如果低2位不为0，则高位数字[2:]就是代表这个小数字；

针对`Number`类型，方法1表示的小数范围更小，方法2表示的小数范围更大。两种方法的并无好坏之分，使用场景不同而已，比如方法1可以用来保存一些状态信息，方法2就如`Number`类型一样，用来存储小数字。回到`struct file`，可以找到如下申明：

```C
struct file {
    //...
} __randomize_layout
  __attribute__((aligned(4)));	/* lest something weird decides that 2 is OK */
```

`struct file`按照4Byte对齐，这意味着它的地址表示方法是`0x???..???00`，这时候用户就可以在低2位插入一些有用的字段了（方法1）。所以现在可以很好的解释`struct file *file = (struct file *)(v & ~3);`就是为了剔除可能标志位，得到`struct file`真正的有效地址。

这时候有另外一个问题，内存对齐一定会消耗更多内存吗？

我想是的，但是可能不如我们想象的多。比如一个32Byte大小的结构体，按照8Byte对齐，它可能会增加0~7Byte的align内存，不是一定增加7Byte。如果是一个上述类型的数组，那么这个数组整体可能增加0~7Byte的align内存，这依赖于第一个元素的地址如何。

