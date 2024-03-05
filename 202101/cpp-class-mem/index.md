# C++类的内存分布


## 问题
更详细的学习, 参考[C++类的内存分布(二)](/202107/cpp-class-mem2/).

使用gdb、g++工具。

<!--more-->

```C++
class A{
public:
    int funcA(){}
    virtual int funcV(){}

public:
    int a;
    char b;
    double c;
};

class B : public A{
public:
    int funcB(){}
    int funcV(){}
public:
    char d;
};


int main()
{
    A *a = new A();
    B *b = new B();

    delete a;
    delete b;
}
```

## 验证
以下每一小节中的地址互不相关。

#### 编译
编译需要带上-g参数，这样可以在gdb调试的时候打印源码。
```
g++ -g test.cpp -o test
```

#### 派生类重写
按照上述源码来
```
gdb test
# 在main函数打断点
(gdb) b main
Breakpoint 1 at 0x555555554863: file test.cpp, line 23.
# 运行至断点处
(gdb) r
# 执行next若干次
(gdb) n
# 查看*a = new A() 的虚表
(gdb) i vtbl a
vtable for 'A' @ 0x555555754d80 (subobject @ 0x555555767e70):
[0]: 0x5555555548fe <A::funcV()>
# 查看*b = new B() 的虚表
(gdb) i vtbl b
vtable for 'B' @ 0x555555754d68 (subobject @ 0x555555767e90):
[0]: 0x55555555490a <B::funcV()>
```

以上，有几个类（不是实例）虚表就有几份，也就是同一个类的多个实例，也只维护一份虚表。

a的funcV和b的funcV的地址是不一样的。0x5555555548fe <A::funcV()> 和 0x55555555490a <B::funcV()>。

注意和以下作对比。

#### 派生类不重写
```
class B : public A{
public:
    int funcB(){}
public:
    char d;
};
```
则派生类的funcV指向了A的funcV，是同一个funcV，地址相同0x555555554932 <A::funcV()>
```
(gdb) i vtbl a
vtable for 'A' @ 0x555555754d80 (subobject @ 0x555555767e70):
[0]: 0x555555554932 <A::funcV()>
(gdb) i vtbl b
vtable for 'B' @ 0x555555754d68 (subobject @ 0x555555767eb0):
[0]: 0x555555554932 <A::funcV()>         # A::funcV()
```

#### 编译器优化
如果此时在gdb中尝试打印funcA的地址，发现找不到，我猜测的原因是编译器优化了，因为在源码中没有任何地方调用了funcA，但是为什么编译器会编译funcV呢？源码中也没任何地方调用了funcV啊？

#### 内存分布
现在在main函数中尝试调用funcA，让编译器编译它。

先来看一下地址：
```
(gdb) p a->funcA
$1 = {int (A * const)} 0x55555555493e <A::funcA()>
(gdb) p &(b->funcA)
$12 = (int (*)(A * const)) 0x55555555493e <A::funcA()>
(gdb) p a->funcV
$2 = {int (A * const)} 0x55555555494a <A::funcV()>
```

可以看到funcA和funcV应该是在一块的，地址比较近0x55555555494a-0x55555555493e=12。

B没有重写funcA，所以b->funcA和a的funcA是指向同一个函数。

a和b的内存也在同一块，但是和func*的内存块隔得比较远。
```
(gdb) p a
$3 = (A *) 0x555555767e70
(gdb) p b
$4 = (B *) 0x555555767eb0
```

类的成员变量接在类的实例化地址之后，是在同一块内存的。

如下，尽管B继承了A，但是B从A继承过来的成员变量并不指向A的成员变量，B有自己的备份。

a->a的地址和b-a的地址并不一样。
```
(gdb) p &(a->a)
$6 = (int *) 0x555555767e78
(gdb) p &(a->b)
$7 = 0x555555767e7c ""
(gdb) p &(a->c)
$8 = (double *) 0x555555767e80
(gdb) p &(b->a)
$9 = (int *) 0x555555767eb8
(gdb) p &(b->b)
$10 = 0x555555767ebc ""
(gdb) p &(b->c)
$11 = (double *) 0x555555767ec0
```

每个类维护自己的虚表，虚表地址和类实例化地址也不一样. 每个类的虚表只有一份， 同一个类的所有实例共享一份。
```
(gdb) i vtbl a
vtable for 'A' @ 0x555555754d80 (subobject @ 0x555555767e70):
[0]: 0x55555555494a <A::funcV()>
(gdb) i vtbl b
vtable for 'B' @ 0x555555754d68 (subobject @ 0x555555767eb0):
[0]: 0x55555555494a <A::funcV()>
```

#### 怎么找到虚表

从上面的实验中可以看到, 虚表和类不在同一块内存, 一般来说, 我们会需要一个额外的指针指向这个虚表的地址, 这样才可以找到这个虚表.

实际上C++编译器也是这么做的, 在编译的时候会给类添加一个__vptr成员变量且指向虚表的地址, 这样就可以通过__vptr找到虚表了.

如果是继承自基类的虚函数, 则在虚表中指向的是同一个函数地址.

## 结论
以上可以猜测出来的几个结论是：
- 类成员函数只有一份，所有实例共享（成员函数地址与实例地址隔得比较远）
- 类的成员变量有多份，不同实例维护不同的成员变量（成员变量地址接在实例地址之后，相隔很近）
- 即使是继承关系，派生类的成员变量也只是基类的复制体，而不是指向同一块内存（派生类的成员变量和基类的地址不一样）
- 派生类会把从基类继承过来的成员变量当做自己的普通成员变量一样看待？（从成员变量的地址可以猜测这个结论）
- 类的虚表只有一份，所有实例共享（虚表的地址和实例化地址隔得比较远，也和成员函数的地址隔得比较远）
- 编译器在编译的时候, 通过给类添加__vptr指针指向虚表而得到虚表地址.

## 图例
不同的方块表示不同的内存块

![结构图](https://bu.dusays.com/2022/06/26/62b877f6b35a5.png "结构图")
