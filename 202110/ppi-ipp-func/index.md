# i++和++i在函数入参时的一些问题


## 问题一: test(x++, x == 1)
以下函数的输出是什么? 本文源码参考: [https://gcc.godbolt.org/z/veMohGYob](https://gcc.godbolt.org/z/veMohGYob)

<!--more-->

```C++
void test(int x, bool bl)
{
    cout << x << "  " << bl << endl;
}
//...
int x = 0;
test(x++, x == 1);
```

## 参数计算顺序和入参顺序

首先, 毫无疑问, **C/C++标准规定的函数参数入参顺序是从右往左**.

按照上述说法, 问题一的数输出应该就是`0  0`. 使用gcc编译, 发现输出结果确实是`0  0`, 但是使用clang编译的输出结果是`0  1`.

不同编译器编译同一个函数, 居然会导致函数的输出不一样. 这是因为在函数参数入参之前还有参数的计算过程.

在[《UCB CS61a SICP Python 中文》一周目笔记(一)](/202108/sicp-python-read1/)中提到了函数参数的**应用序和正则序**, 按照我们的认知和经验, C/C++编译器使用的是应用序, 所以在函数入参之前需要计算参数的结果. 但是, 同入参顺序, 参数计算也有顺序. C/C++标准中没有规定函数参数的计算顺序, 所以导致**不同的编译器可能定义了不同的参数计算顺序**.

如上结果:
1. gcc的参数计算顺序是从右往左;
2. clang的参数计算顺序是从左往右;

## 问题二: test(m_idx++)
下面这个类`Test`, 调用`test()`方法的输出是什么?
```C++
class Test{
public:
    Test() : m_idx(0) {}
    ~Test() {}
    void test() {
        test(m_idx++);
    }
private:
    void test(int idx) {
        cout << idx << "  " << m_idx << endl;
    }
    int m_idx;
};
//...
Test t;
t.test();
```

这里不涉及问题一的计算顺序了. 经过测试, `test`的输出结果是`0  1`, 这意为着`m_idx++`在入参时是传入的没有++的`m_idx`, 但是在调用函数之后, 有发现`m_idx`被++了, 也就是说, `m_idx + 1`的动作发生在入参前后. 这里涉及到的知识点是`x++`和`++x`的计算时机.

## i++和++i的计算时机

先来看看汇编结果:
```ASM
Test::test():
 mov    QWORD PTR [rbp-0x8],rdi
 mov    rdi,QWORD PTR [rbp-0x8]
 mov    esi,DWORD PTR [rdi]
 mov    eax,esi
 add    eax,0x1
 mov    DWORD PTR [rdi],eax
 call   401350 <Test::test(int)>
 ## ...

Test::test(int):
 mov    DWORD PTR [rbp-0xc],esi
 mov    rax,QWORD PTR [rbp-0x8]
 mov    QWORD PTR [rbp-0x18],rax
 mov    esi,DWORD PTR [rbp-0xc]
```

首先是拿到了`m_idx`, 然后将`m_idx`的值存入`esi`寄存器, 再将`esi`寄存器的值(这时候就是`m_idx`的值)存入`eax`寄存器, 然后`eax+1`, 再将`eax`寄存器加完后的结果存如`m_idx`, 然后调用`test(int)`函数. 在`test(int)`中会将`esi`寄存器的值作为入参参数.

所以我们可以得到一个结论: 执行`test(m_idx++);`时, 先将`m_idx`送入`esi`寄存器(源变址寄存器), 再复制到`eax`寄存器(累加寄存器), 再在`eax`寄存器执行`++`操作, 然后送入`m_idx`, 这时候`m_idx`已经执行完+1操作了. 参数入参时使用的是`esi`中的值, 所以入参的值是没有加一的值.

如果是`test(++m_idx);`呢?
```ASM
Test::test():
 mov    QWORD PTR [rbp-0x8],rdi
 mov    rdi,QWORD PTR [rbp-0x8]
 mov    esi,DWORD PTR [rdi]
 add    esi,0x1
 mov    DWORD PTR [rdi],esi
 call   401350 <Test::test(int)>
```
可以发现, 没有使用临时寄存器了, 而是直接在`esi`寄存器上使用+1操作. 所以入参的值就是加完之后的值.
