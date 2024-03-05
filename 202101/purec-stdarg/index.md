# C里面的变长参数


## stdarg.h
这里用到的是```stdarg.h```这个库, 可以在C语言里面实现可变长参数.

> 当然C++会简单得多, C++11之后的模板原生支持可变长参数.

几个函数va_list、va_start、va_arg、va_end，定义在stdarg.h

<!--more-->

## 内存结构
先需要理解C/C++函数入参的顺序.

按照以下的demo, 将其翻译成汇编代码.
```C
#include <iostream>
using namespace std;

int sum(const int &a, const int &b, const int &c)
{
    int d = 0;
    d = a + b + c;
    return d;
}

int main()
{
    int s = sum(1, 2, 3);
    cout << s << endl;

    return 1;
}
```

首先是main函数, 主体部分的汇编
```C
mov    DWORD PTR [rbp-0x10],0x3
mov    DWORD PTR [rbp-0xc],0x2
mov    DWORD PTR [rbp-0x8],0x1
lea    rdx,[rbp-0x10]
lea    rcx,[rbp-0xc]
lea    rax,[rbp-0x8]
mov    rsi,rcx
mov    rdi,rax
call   401172 <sum(int const&, int const&, int const&)>
```

可以看到, main函数调用了sum函数, 首先搜获取三个参数, 1, 2, 3; 获取顺序是从右往左的. 先获取了3再是2再是1.

之后是一些操作将这三个参数从内存放到寄存器(Why?), 然后调用sum函数.

sum函数的汇编代码如下
```C
mov    QWORD PTR [rbp-0x18],rdi
mov    QWORD PTR [rbp-0x20],rsi
mov    QWORD PTR [rbp-0x28],rdx
mov    DWORD PTR [rbp-0x4],0x0
mov    rax,QWORD PTR [rbp-0x18]
mov    edx,DWORD PTR [rax]
mov    rax,QWORD PTR [rbp-0x20]
mov    eax,DWORD PTR [rax]
add    edx,eax
mov    rax,QWORD PTR [rbp-0x28]
mov    eax,DWORD PTR [rax]
add    eax,edx
mov    DWORD PTR [rbp-0x4],eax
mov    eax,DWORD PTR [rbp-0x4]
```

首先是从寄存器取值, 放到内存, 然后进入函数, 执行函数内部的操作, 最后将计算结果从内存放到寄存器. 这里注意一下型参的顺序.
rdi, rsi, rdx对应的内存分别是a, b, c.

所以, 可以对上面的demo, 可以知道其内存分布是

- 对函数本体:

从低地址到高地址, 型参按照从左往右的顺序, 函数体按照从上往下的顺序执行;

![函数本体](https://bu.dusays.com/2022/06/26/62b87a591f18a.png  "函数本体")

- 对函数调用:

从低地址到高地址, 实参按照从右往左的顺序, 函数体按照从上往下的顺序执行;

![函数调用](https://bu.dusays.com/2022/06/26/62b87a5bce077.png  "函数调用")

## 内存对齐
源码头文件中，注意一下这个宏，内存对齐作用 [看这里](https://www.cnblogs.com/cpoint/p/3369456.html)：

```C
#define __va_rounded_size(TYPE)  \
  (((sizeof (TYPE) + sizeof (int) - 1) / sizeof (int)) * sizeof (int))
```

1. TYPE size >= 4，偏移量=(sizeof(TYPE) / 4) * 4
2. TYPE size < 4, 偏移量=4

所以是按4Byte，32位对齐。

## va_list
```C
typedef char *va_list;
```
仅是一个指针, 这是一个适用于 va_start()、va_arg() 和 va_end() 这三个宏存储信息的类型。

## va_start
将AP指向第一个参数的下一个参数的地址.
```C
#ifndef __sparc__
#define va_start(AP, LASTARG)                                           \
 (AP = ((char *) &(LASTARG) + __va_rounded_size (LASTARG)))
#else
#define va_start(AP, LASTARG)                                           \
 (__builtin_saveregs (),                                                \
  AP = ((char *) &(LASTARG) + __va_rounded_size (LASTARG)))
#endif
```

## va_arg
AP指向下一个参数, 同时返回上一个参数的内容.
```C
#define va_arg(AP, TYPE)                                                \
 (AP += __va_rounded_size (TYPE),                                       \
  *((TYPE *) (AP - __va_rounded_size (TYPE))))
```

## va_end
将AP指针置空, 做保护用.
```C
#define va_end(AP)
//有些代码中定义为
#define va_end(ap)      ( ap = (va_list)0 )
```

## 用例
```C
int sum(int count, ...)
{
    va_list vl;
    int sum = 0;
    va_start(vl, count);
    for (int i = 0; i < count; ++i)
    {
        sum += va_arg(vl, int);
    }
    va_end(vl);
    return sum;
}
```
结合开头讲述的内存分布就不难理解, ```va_list```是一个指针, 型参都是在连续内存中的.

```va_start(vl, count)```的时候, 指向了count的下一个指针(count地址, 加上count的size).

```va_arg(vl, int)```的时候, 先是将vl指向下一个地址, 然后再返回上一个地址的值.
