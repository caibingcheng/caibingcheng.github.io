# C++模板问题之多出的static


## 问题
先看以下代码

<!--more-->

```C++
#include <iostream>

using namespace std;
using uint32 = unsigned int;

template<bool ISIN>
static void updateVal(uint32 &val)
{
    static uint32 sval;

    if (ISIN)
    {
        sval = val;
    }
    else
    {
        val = sval;
    }
}

int main()
{
    uint32 a = 1;
    uint32 b = 2;

    updateVal<true>(a);
    updateVal<false>(b);

    cout << b << endl;
}
```

> 期望是根据```ISIN```生成不同的语句, 但是实际上是生成了不同函数.

updateVal函数期望实现的功能是, 当模板值为true的时候, 表示向sval存入变量val的值; 当模板值为false时, 表示将sval的值存入到val中.

期望上述代码的b的输出时1(原本时2, 然后被赋值1).

实际输出是

```
0
```

## 验证
可以查看上述代码的汇编代码, 仅截取一小段.

```S
lea    rdi,[rbp-0x4]
call   401230 <void updateVal<false>(unsigned int&)>
lea    rdi,[rbp-0x8]
call   401250 <void updateVal<true>(unsigned int&)>
```

以上, 两个call实际上就是两次调用updateVal函数, 但是很奇怪, 两次call的地址不一样, 也就是updateVal实际上有两份, 我们再看看updateVal函数的汇编.

```S
401230  push   rbp
        mov    rbp,rsp
        mov    QWORD PTR [rbp-0x8],rdi
        mov    eax,DWORD PTR ds:0x404198
        mov    rcx,QWORD PTR [rbp-0x8]
        mov    DWORD PTR [rcx],eax
        pop    rbp
        ret
        nop    WORD PTR [rax+rax*1+0x0]
401250  push   rbp
        mov    rbp,rsp
        mov    QWORD PTR [rbp-0x8],rdi
        mov    rax,QWORD PTR [rbp-0x8]
        mov    ecx,DWORD PTR [rax]
        mov    DWORD PTR ds:0x40419c,ecx
        pop    rbp
        ret
        nop    WORD PTR [rax+rax*1+0x0]
```

可以看到有两个ds区的数据, 这代表有两个static变量, 也就是说, 因为函数有两份, 导致sval也有两份, 互不干扰, 所以函数无效.

实际上, 给模板输入不同的参数本来就会生成不同的函数, 即使是模板变量也是如此, 所以在上面我们可以看到, 这两个updateVal函数, 在编译期就已经确定了.

正确的写法应该是不使用模板, 或者将static移动到函数体外. 如下, 在运行期可以少做一点运算, 但是会占用更多的内存空间.

```C++
static uint32 sval = 0;

template<bool ISIN>
static void updateVal(uint32 &val)
{
    if (ISIN)
    {
        sval = val;
    }
    else
    {
        val = sval;
    }
}
```

## 结论
- 模板变量会在编译期确定;
- 使用了"任意"模板的函数可能在编译期生成多份;
- 看起来是对"语句"模板, 实际上模板是对函数作用的;
