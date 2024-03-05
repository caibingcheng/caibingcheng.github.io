# 数据结构与算法之栈


## 什么是栈

栈是一种数据结构, 满足先入后出.

一般栈支持以下几个操作:

<!--more-->


```C++
push(n);    //数据入栈
a.pop();    //数据出栈
a.top();    //获取栈顶元素
a.size();   //获取栈中元素数量
a.empty();  //是否是空栈
```


## C++中的stack容器

[官方文档](https://en.cppreference.com/w/cpp/container/stack)中, 定义如下

```C++
template<
    class T,
    class Container = std::deque<T>
> class stack;
```

std::stack是一个C++模板类, 有两个模板参数T和Container, T代表容器元素的数据类型, Container则代表stack使用的容器, 默认使用std::deque这个容器. 这意味着, stack相当于是对已有容器的改装, 也可以使用用户自定义的容器.

Container必须提供以下几种方法:

1. 支持back();
2. 支持pop_back();
3. 支持push_back();

相当于都是往Container的后面塞入或者弹出数据, 也就是Container也需要满足的stack的基本功能.

因此, 我们将自定义或者其他C++标准容器转换为stack容器. 以下是官方的demo, 我添加了vector的转换以加强理解.

```C++
#include <stack>
#include <deque>
#include <vector>
#include <iostream>

int main()
{
    std::stack<int> c1;
    c1.push(5);
    std::cout << c1.size() << '\n';

    std::stack<int> c2(c1);
    std::cout << c2.size() << '\n';

    std::deque<int> deq {3, 1, 4, 1, 5};
    std::stack<int> c3(deq);                //stack的Container默认就是deque, 所以无需再次声明
    std::cout << c3.size() << '\n';

    // int ds[3] = {1, 2, 3};               //使用数组是不行的, 因为普通数组没有实现Container要求的操作
    std::vector<int> ds {1, 2, 3};
    std::stack<int, std::vector<int>> c4(ds);   //vector不是stack默认的Container类型, 所以需要声明
    std::cout << c4.size() << '\n';
}
```

## 括号匹配问题

括号匹配问题一般描述是:

> 给定一个字符串S, 其中包含'{}'/'[]'/'()'三种括号对, 例如S1 = "[]{}({})", S2 = "[{(}])", 其中S1是合法的, S2是不合法的. 设计一个函数, 判断输入的仅包含括号字符的字符串是否合法.

```C++
bool isBracketOk(const string &s)
{
    const static char brackets_table[][2] = {
        {'(', ')'},
        {'[', ']'},
        {'{', '}'}
    };
    auto is_match = [=] (const char &a, const char &b) -> bool {
        bool match = false;
        for (int i = 0; i < 3; i++)
        {
            match = ((a == brackets_table[i][0]) && (b == brackets_table[i][1]));
            if (match)
            {
                return match;
            }
        }
        return match;
    };
    auto is_left = [=] (const char &a) -> bool {
        for (int i = 0; i < 3; i++)
        {
            if (a == brackets_table[i][0])
            {
                return true;
            }
        }
        return false;
    };
    auto is_right = [=] (const char &a) -> bool {
        for (int i = 0; i < 3; i++)
        {
            if (a == brackets_table[i][1])
            {
                return true;
            }
        }
        return false;
    };

    stack<char> ss;
    for (const char &c : s){
        if (ss.empty())
        {
            if (is_left(c))
            {
                ss.push(c);
                continue;
            }
            else
            {
                return false;
            }
        }
        else
        {
            if (is_left(c))
            {
                ss.push(c);
                continue;
            }
            if (is_right(c))
            {
                if (is_match(ss.top(), c))
                {
                    ss.pop();
                    continue;
                }
                else
                {
                    return false;
                }
            }
        }
    }
    return ss.empty();
}
```

我们先定义一些函数, 用于判断给定字符是不是括号, 是左括号还是右括号, 判断给定字符对是不是匹配的括号.

对待判断的字符串, 如果是左括号则入栈, 如果是右括号, 则从判度栈顶字符和当前字符是不是匹配的括号对, 并弹出;

### 一个思考

曾经有一段时间, 我坚信一个函数应该且必须只有一个return.

但是渐渐也发现这样做的弊端, 代码会需要重构, 可能会有很多的临时变量, 也可能会有很深的嵌套逻辑, 而且多个return的可读性也不差.

所以, 一个函数该不该有多个return呢? 还有待更多的经验积累, 不能听风就是雨.
