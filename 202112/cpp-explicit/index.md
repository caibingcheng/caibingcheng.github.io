# explicit说明符


一直对`explicit`的认知比较模糊, 在准备智能指针内容的时候, 看到了这个内容, 所以索性认认真真学习一遍.

简单来说, `explicit`表达的是: 只允许显示行为, 不允许隐式行为.

要理解上面的解释, 就需要理解哪些是C++的显示行为, 哪些是隐式行为.

<!--more-->

## 显示行为和隐式行为
以下是cppreference的[demo源码](https://en.cppreference.com/w/cpp/language/explicit):
```C++
struct A
{
    A(int) { }      // converting constructor
    A(int, int) { } // converting constructor (C++11)
    operator bool() const { return true; }
};

struct B
{
    explicit B(int) { }
    explicit B(int, int) { }
    explicit operator bool() const { return true; }
};

int main()
{
    A a1 = 1;      // OK: copy-initialization selects A::A(int)
    A a2(2);       // OK: direct-initialization selects A::A(int)
    A a3 {4, 5};   // OK: direct-list-initialization selects A::A(int, int)
    A a4 = {4, 5}; // OK: copy-list-initialization selects A::A(int, int)
    A a5 = (A)1;   // OK: explicit cast performs static_cast
    if (a1) ;      // OK: A::operator bool()
    bool na1 = a1; // OK: copy-initialization selects A::operator bool()
    bool na2 = static_cast<bool>(a1); // OK: static_cast performs direct-initialization

//  B b1 = 1;      // error: copy-initialization does not consider B::B(int)
    B b2(2);       // OK: direct-initialization selects B::B(int)
    B b3 {4, 5};   // OK: direct-list-initialization selects B::B(int, int)
//  B b4 = {4, 5}; // error: copy-list-initialization does not consider B::B(int,int)
    B b5 = (B)1;   // OK: explicit cast performs static_cast
    if (b2) ;      // OK: B::operator bool()
//  bool nb1 = b2; // error: copy-initialization does not consider B::operator bool()
    bool nb2 = static_cast<bool>(b2); // OK: static_cast performs direct-initialization
}
```

对类`A`来说, 以下是显示行为:
```C++
A a2(2);       // OK: direct-initialization selects A::A(int)
A a3 {4, 5};   // OK: direct-list-initialization selects A::A(int, int)
A a5 = (A)1;   // OK: explicit cast performs static_cast
if (a1) ;      // OK: A::operator bool()
bool na2 = static_cast<bool>(a1); // OK: static_cast performs direct-initialization
```
`a2`和`a3`好理解, 因为就是直接调用`A`的构造函数, 这里不存在转换.

`A a5 = (A)1;`存在转换, 但是是显示的, 这是用户明确需要转换的, 不是编译器的默认行为, 所以这里是显示转换.

`if (a1) ;` 这里用户没有明确, 但是因为是`if`语句, 所以其`expression`是`bool`型的, 不存在编译器的隐式行为, 所以这里也可以认为是显示转换.

`bool na2 = static_cast<bool>(a1);` 同上, 这是用户明确的行为, 不是编译器的行为, 所以是显示转换.

以下是隐式行为:
```C++
A a1 = 1;      // OK: copy-initialization selects A::A(int)
A a4 = {4, 5}; // OK: copy-list-initialization selects A::A(int, int)
bool na1 = a1; // OK: copy-initialization selects A::operator bool()
```

`a1`和`a4`, 会转换为`A(int)`和`A(int, int)`, 存在隐式转换.

`bool na1 = a1;` 用户没有明确转换类型, 依赖于编译器的转换, 所以存在隐式转换.

以上分析了类`A`的行为, 对类`B`的构造和转换函数都加上了`explicit`说明, 所以对类`B`, 存在隐式行为的地方将不被允许.

在类`B`中以下是不被运行的隐式行为:
```C++
B b1 = 1;      // error: copy-initialization does not consider B::B(int)
B b4 = {4, 5}; // error: copy-list-initialization does not consider B::B(int,int)
bool nb1 = b2; // error: copy-initialization does not consider B::operator bool()
```

比如参考[这篇文章](http://c.biancheng.net/cpp/biancheng/view/222.html)中复数运算的例子:
```C++
#include <iostream>
using namespace std;
class Complex
{
public:
   Complex( ){real=0;imag=0;}
   Complex(double r,double i){real=r;imag=i;}
   operator double( ) {return real;} //类型转换函数
private:
   double real;
   double imag;
};

int main( )
{
   Complex c1(3,4),c2(5,-10),c3;
   double d;
   d=2.5+c1;//要求将一个double数据与Complex类数据相加
   cout<<d<<endl;
   return 0;
}
```
`d=2.5+c1;`存在隐式行为. 所以如果我们给类型转换函数添加`explicit`说明后, 编译将不通过, 比如有如下错误:
```
<source>:18:9: error: no match for 'operator+' (operand types are 'double' and 'Complex')
   18 |    d=2.5+c1;//要求将一个double数据与Complex类数据相加
      |      ~~~^~~
      |      |   |
      |      |   Complex
      |      double
```
这时候就需要将`d=2.5+c1;`修改为显示的, 这样做`d=2.5+double(c1);`就可以了.

添加`explicit`说明后, 如果改成`d=2.5+float(c1);`编译器也会报错:
```
<source>:18:10: error: invalid cast from type 'Complex' to type 'float'
   18 |    d=2.5+float(c1);//要求将一个double数据与Complex类数据相加
      |          ^~~~~~~~~
```
这是很好的, 至少可以规范用户的行为, 用户需要明确知道当前应该是什么数据类型, 因此不会出现因为数据类型导致的超出预期的问题(比如精度或值域).

我尝试在Rust中寻找关于隐式行为的内容(因为我始终认为在默认行为部分Rust比C++做得更安全), 找到了[这部分](https://rustmagazine.github.io/rust_magazine_2021/chapter_7/coercion_in_rust.html)中的一句话:

> 标准库中有一个函数std::mem::transmute，它可以将任意类型转换成其他类型。该函数是unsafe的，因为它不能保证输入类型的有效位可以表示为输出类型的有效位。确保这两种类型兼容由用户决定。

这句话对我的启发是:

1. 所有代码的编译结果"基本"都一样, 那怎么保证代码的安全性? 可以交给人或者交给机器. 比如类型转换的功能, 如果交给人, 编译器就可以大量使用隐式转换, 但是用户就需要知道自己写的是什么, 是从什么转换成什么, 编译器对此会有什么样的行为, 不然就可能不安全. 如果交给机器, 机器是不相信人类的, 那么编译器就尽量不使用隐式转换, 用户就必须明确转换类型, 确保这些是编译器的允许行为, 不然编译器不允许通过. C++有不少的安全性是交由用户管理的, 所以我们可以写出很灵活的代码, 比如各种类型的隐式转换, 不容易被局限, 但是人也不总是那么可靠.

2. 不要只局限于运行期, 编译期也能做很多事情, 不仅仅只有`template`. 比如可以在编译期做一些运算(判断/求和等等), 或者像类型检查一样做一些其他的检查等等, 这可能有点magic(元编程容易被这样认为), 但是需要有这种思维或者知识.

## explicit is better than implicit

这小结的标题是Python禅宗中的格言, 曾经读过, 但是今天不学习`explicit`的话, 可能还回忆不起这句话.

在["如何理解 Explicit is Better than Implicit?"](https://lotabout.me/2021/Explicit-is-Better-than-implicit/)中, 作者谈到了自己的理解, 我认为和[《UCB CS61a SICP Python 中文》一周目笔记(一)
](/202108/sicp-python-read1/#函数抽象)中有部分观点是类似的:

1. 用户不会惊讶于函数的返回
2. 用户不会惊讶于函数的输入

显式行为就是我们通过代码就很容易理解的行为, 而不需要过多了解编译器将会怎么做, 这不仅仅局限于类型转换.

比如在"如何理解..."这篇文章中, 作者举例的`read_csv`和`read_json`, 是很明显的显式行为, 输入文件名, 输出对应文件类型的内容/对象. 但是`read`也没那么差, 比如可以有两个类`CSV`和`JSON`, 那么他们各自有一个公共接口`read`, 通过这个接口可以返回对应文件类型的内容/对象, 这也是不错的, 我认为也是显式的.

怎么运用在自己的代码中? 我认为依赖于代码阅读量的积累. 需要阅读一些通用, 很多人使用过的代码(比如一些开源项目). 我自己写的时候, 也会考虑, 是不是见过类似的片段, 如果见过的, 我会大胆的写, 如果没见过的, 并且也没有其他想法的话, 我也会写下去. 想到围棋中的一个词描述: **定式**.

代码也是有定式的. 比如写一个线程池, 会怎么写? 我刚开始会想需要什么接口, 比如`add`啊, `start`啊, 等等, 慢慢这东西就会变成某项目专用的工具, 迁移性不高了. 但是比如这个超过1k fork/5k star的[ThreadPool](https://github.com/progschj/ThreadPool/blob/master/ThreadPool.h), 接口很少, 这些是很值得学习的, 可以认为是定式, 代码量不大, 容易看懂. 我想起我们leader对我说的, 大概意思是: 写工具类先写一个通用的工具基类, 再根据项目需求添加功能更丰富的子类, 而不是一上来就根据项目需求开始动手了. 这种思想很有用, 再用线程池举例, 比如可以按照[ThreadPool](https://github.com/progschj/ThreadPool/blob/master/ThreadPool.h)实现一个只有`enqueue`方法的基类, 再按照需求实现有`start`/`stop`/`wait`功能之类的子类.
