# 值传递OR引用传递


## 目的

验证值传递和引用传递的区别。

<!--more-->


- 值传递会拷贝，引用传递不会拷贝；
- 如果类是禁止拷贝的，就不能使用值传递；
- C++推荐使用引用传递；

## 实验

#### 禁止拷贝使用引用传递

```cpp
#include <iostream>

using namespace std;

class A {

public:
    A(){}

private:
    A(const A& other) {
        cout << "copy construcor" << endl;
    }

    void operator=(const A& other) {
        cout << "copy function" << endl;
    }
};

void tA(A &a)
{
    ;
}

int main()
{
    A a;
    tA(a);
}
```

以上，类A的拷贝函数是private的，所以认为是禁止拷贝，此时tA函数参数是引用传递的，编译通过。

#### 禁止拷贝使用值传递

修改代码：

```cpp
void tA(A a)
{
    ;
}
```

编译是不通过的，以下报错，这个可以说明**值传递是需要拷贝函数的**。

```cpp
error: 'A::A(const A&)' is private within this context
```

#### 允许拷贝使用引用传递

修改代码：

```cpp
class A {

public:
    A(){}
    A(const A& other) {
        cout << "copy construcor" << endl;
    }

    void operator=(const A& other) {
        cout << "copy function" << endl;
    }
};

void tA(A &a)
{
    ;
}

```

编译通过，运行程序没有输出，则说明**引用传递没有调用拷贝函数**。

#### 允许拷贝使用值传递

修改代码：

```cpp
void tA(A a)
{
    ;
}
```

编译通过，输出

```cpp
copy construcor
```

这样说明值传递是会做拷贝的，看这个例子，**值传递是调用的拷贝构造函数**

## 结论

- 值传递是需要拷贝函数的
- 值传递是调用的拷贝构造函数
- 引用传递没有调用拷贝函数
