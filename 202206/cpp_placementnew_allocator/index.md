# C++在给定内存上构造

当初始化一个类数组的时候，有什么方法可以减少构造和复制操作呢？

<!--more-->
假设有以下类：
```c++
class Foo {
public:
    Foo() : i(-1) {
        printf("construct %p %d\n", this, i);  
    } 
    Foo(int val) : i(val) {
        printf("construct %p %d\n", this, i); 
    }
    ~Foo() {
        printf("distruct %p %d\n", this, i); 
    }

    Foo &operator=(const Foo& foo)
    {
        i = foo.i;
        printf("copy %p %d\n", this, i);
        return *this;
    }
private:
    int i;
};
```
对于一个类`Foo`，我们的目标是构建其数组形式，并希望尽量减少构造和复制。

## 常规数组

常规数组访问方式如下：
```c++
printf("=================1\n"); 
Foo array1[2];
for (int i = 0; i < 2; ++i)
	array1[i] = Foo(i);
```
将得到以下输出，构造4次，复制2次，十分普通：
```
=================1
construct 0x7ffd5d59b504 -1
construct 0x7ffd5d59b508 -1
construct 0x7ffd5d59b510 0
copy 0x7ffd5d59b504 0
distruct 0x7ffd5d59b510 0
construct 0x7ffd5d59b510 1
copy 0x7ffd5d59b508 1
distruct 0x7ffd5d59b510 1
distruct 0x7ffd5d59b508 1
distruct 0x7ffd5d59b504 0
```
或者是初始化时构造：
```c++
{
	printf("=================0\n"); 
	Foo array0[2]{1, 2};
}
```
得到以下输出，只构造两次，没有复制，满足需求，但是如果数组很大的话，这种形式明显就不太好了：
```c++
=================0
construct 0x7ffc8c1be584 1
construct 0x7ffc8c1be588 2
distruct 0x7ffc8c1be588 2
distruct 0x7ffc8c1be584 1
```
## 复制

移除上述`Foo array1[2];`的默认构造过程，又可以产生以下的代码：
```c++
printf("=================2\n"); 
char data2[sizeof(Foo) * 2];
Foo *array2 = reinterpret_cast<Foo *>(data2);
for (int i = 0; i < 2; ++i)
	array2[i] = Foo(i);
for (int i = 0; i < 2; ++i)
	array2[i].~Foo();
```
注意到，我们需要手动调用析构，得到以下输出，构造2次，复制2次，已有所优化了：
```c++
=================2
construct 0x7ffe4cf09c14 0
copy 0x7ffe4cf09c08 0
distruct 0x7ffe4cf09c14 0
construct 0x7ffe4cf09c14 1
copy 0x7ffe4cf09c0c 1
distruct 0x7ffe4cf09c14 1
distruct 0x7ffe4cf09c08 0
distruct 0x7ffe4cf09c0c 1
```

## placement new

通过这个问题，我学习到了`placement new`（以前可能学习过，但是完全忘记了TAT），使用`placement new`可以再次优化，直接在给定的内存上构造，其原理如何，我认为这些知识点不是我目前想追求的，所以不做讨论。总之，可以得到以下代码：
```c++
printf("=================3\n"); 
char data3[sizeof(Foo) * 2];
Foo *array3 = reinterpret_cast<Foo *>(data3);
for (int i = 0; i < 2; ++i)
	auto pA = new(array3 + i * sizeof(Foo)) Foo(i);
for (int i = 0; i < 2; ++i)
	reinterpret_cast<Foo*>(array3 +  + i * sizeof(Foo))->~Foo();
```
得到以下输出，只构造2次，没有复制：
```
=================3
construct 0x7ffe4cf09c00 0
construct 0x7ffe4cf09c10 1
distruct 0x7ffe4cf09c00 0
distruct 0x7ffe4cf09c10 1
```

## allocator

上述`placement new`方案有点不太美观，特别是`reinterpret_cast`之处，考虑使用`allocator`分配，得到以下代码：
```c++
printf("=================4\n"); 
std::allocator<Foo> alloc;
using traits_t = std::allocator_traits<decltype(alloc)>;
Foo *array4 = traits_t::allocate(alloc, 2);
for (int i = 0; i < 2; ++i)
	traits_t::construct(alloc, array4 + i, i);
for (int i = 0; i < 2; ++i)
	traits_t::destroy(alloc, array4 + i);
traits_t::deallocate(alloc, array4, 2);
```
同样输出如下，只构造2次，没有复制，不过通过内存地址也可以看出，这是堆上分配的：
```
=================4
construct 0x1e50ec0 0
construct 0x1e50ec4 1
distruct 0x1e50ec0 0
distruct 0x1e50ec4 1
```

## 小结

以上只是针对今天一个问题的解答，`placement new`或者`allocator`是否是更优的答案，我认为具体问题还需要具体分析。如果是确定大小的数组，通过`vector`之类的容器，使用`reserve`事先分配好内存，再构造也是可以的，但是`vector`是不是最优的，就需要根据实际需求去分析。比如再考虑以下问题，数组大小是否固定，对随机访问的性能要求，对插入删除的性能要求，对堆或者栈的性能要求等等，不同的需求倾向可能会导致不同的选择。

本文代码可见[https://gcc.godbolt.org/z/Y8s84q9ev](https://gcc.godbolt.org/z/Y8s84q9ev)
