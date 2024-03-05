# C++闭包


## C++闭包

在一些现代对高级语言, 比如Python或者JavaScript中, 经常会提到闭包的概念, 但是在C++里面很少会听说闭包的概念.

C++可以实现闭包吗? 可以.

<!--more-->

> 闭包函数: 可以理解为函数里面定义的函数;

> 闭包: 可以理解为闭包函数可以访问到外层函数的变量, 即使外层函数已经返回.

这一点可能不是很好理解, 先来看一个例子:
```C++
int main()
{
    auto add = [] (const int& a) {
        int b = a * a;
        cout << "call f1 " << b << endl;
        return [b] (const int &c) {
            int d = b + c;
            cout << "call f2 " << d << endl;
            return d;
        };
    };

    auto add_2 = add(2);
    cout << "------------" << endl;
    auto add_2_3 = add_2(3);

    return 1;
}
```

定义一个```add```函数, 作用是$f(x, y) = x * x + y$;

```add_2```获取了外层函数, 外层函数有局部变量```b```, $b = a * a$, 存储了入参2的初步计算结果, 返回值是另外一个匿名函数;

```add_2_3```相当于获取了外层函数的局部变量```b```, 同时也获取了内层函数对返回值.

所以, 上述输出会是:
```
call f1 4
------------
call f2 7
```

也可以这样调用:
```C++
auto add_2 = add(2);
add_2(3); //7
add_2(4); //8
```
上述的调用方法会让```add_2```看起来和```int add_2 = 2```之类的定义很像.(就像是一个普通的变量)

或者:
```C++
add(2)(3);  //7
add(4)(5);  //13
```

## lambda表达式

> 一般形式: [捕获变量] (形参) {语句};

### 捕获变量

一般我们可以用=和&来捕获所有变量, =代表值捕获, &代表应用捕获;

或者, 可以是某个具体的参数, 如果直接使用参数, 就是值捕获, 如果是参数前带&就是引用捕获;

再或者, 可以是一条语句, 比如```[&, sum = cal_sum()]() {//...}```.

我们来看一个例子:
```C++
int num = 1;
[num](){
    num = 2;
    cout << num << endl;
}();
cout << num << endl;
```
会编译失败, 提示:
```
<source>:36:13: error: assignment of read-only variable 'num'
```
因为lambda模式是const的, 不可修改捕获变量.(可以理解成类中的const成员函数, 捕获变量则理解为成员变量)

我们可以加一个mutable声明, 同类一样, 加上mutable声明后, 就可以在const成员函数中修改成员变量了, 相当于明确告诉编译器, 我非常明确知道我接下来的操作会有什么影响, 你不用优化了.
```C++
int num = 1;
[num]() mutable {
    num = 2;
    cout << num << endl;
}();
cout << num << endl;
```
输出是:
```
2
1
```
这里和预期是相符的, 因为我们使用的是值捕获, 如果改成引用捕获就会输出:
```
2
2
```

引用捕获可以减少拷贝行为, 但是**无脑使用引用捕获也会引起一些问题**.
```C++
auto add = [] (const int& a) {
    int c = a * a;
    return [&c] (const int &b) {
        return c + b;
    };
};
cout << add(1)(2) << endl;
```
在我的编译环境下, 这段代码对输出是32769, 是意料之外的, 预期输出应该是3.

问题在于使用了引用捕获, 在```add(1)```调用外层函数的之后, ```int c = a * a;```作为局部变量已经被释放了, 所以调用```add(1)(2)```会出现引用错误.

正确做法是使用值捕获, 会拷贝一次, 但是不管怎样拷贝的值是我们想要的, 不会引起错误.

### 形参

用到lambda会想到一个问题, 能不能像模板函数一样呢? 可以的.

比如实现加法计算, 可以如下定义:
```C++
auto add = [] (auto a, auto b) {
    return a + b;
};
cout << add(1, 2.2) << endl;
```
如果是模板实现, 则要麻烦得多:
```C++
template<typename T>
auto add(T a, T b)
{
    return a + b;
}
//...
cout << add(1, 2.2) << endl;
```
调用```add(1, 2.2)```是会报错的, 因为入参2.2时```T```推导时```double```, 入参1时推导是```int```, 找不到匹配函数. 得定义两个模板类型:
```
template<typename T1, typename T2>
auto add(T1 a, T2 b)
{
    return a + b;
}
```
很明显, 使用lambda和```auto```会简单一些.

### 一般性用法

#### 代码片段打包

一般性, 可以将lambda用于打包小段功能代码, 比如重复性的log:
```C++
const auto stat_log = [=](const int &index, const PROCESSSTAT &process_stat) {
    logi("processing index[{}] stat {} next {}, ret {}", index,
        statStr(process_stat).c_str(), statStr(getCurrentStat()).c_str(),
        statStr(m_algo_ret).c_str());
};
```
在需要调用对地方, 只需要调用```stat_log```函数就行了:
```C++
stat_log(index, PROCESSSTAT::PROCESSRUN);
stat_log(index, PROCESSSTAT::PROCESSERROR);
```
相较于非lambda情况, 我们**不再需要在外部定义一个函数, 减少了接口暴露的问题**.

#### 作为入参

在以往, 实现回调功能需要使用函数指针实现, 但是C++11之后可以使用function对象.

lambda表达式是一个function对象, 我们可以将其作为函数对入参. 比如```sort```函数:
```C++
int main()
{
    vector<int> v{4, 3, 1, 2};
    sort(v.begin(), v.end());
    for_each(v.begin(), v.end(), [](const int& a){
        cout << a << endl;
    });
}
```
默认是按照递增排序, 如果需要递减, 则:
```C++
sort(v.begin(), v.end(), greater<int>());
```

或者, 我们也可以实现自己定义的排序规则, 比如:
```C++
sort(v.begin(), v.end(), [](const int& a, const int& b){
    return a < b;
});
```
自定义排序函数, 在对一些复杂结构(如struct)排序时很有用, 我们可以指定排序的参考key.

再看这一段:
```C++
for_each(v.begin(), v.end(), [](const int& a){
    cout << a << endl;
});
```
借用```for_each```遍历, 使用lambda表达式, 我们可以实现很多不同的功能, 仅仅修改表达式的内容即可.

比如实现四则运算:
```C++
unordered_map<char, function<int(const int&, const int&)>> cal{
    {'+',   [](const int& a, const int& b){
                return a + b;
            }
    },
    //...
};
cout << cal['+'](1, 2) << endl;
```

### lambda展开

lambda表达式的功能很强大, 是怎么做到的呢?

来看一个简单的例子:
```C++
#include <algorithm>
#include <iostream>

using namespace std;

int main()
{
    auto lmd_func = [] (const int& a) {
        int b = a * a;
        return b;
    };

    auto lmd_ret = lmd_func(2);
    cout << lmd_ret << endl;

    return 1;
}
```
编译过程中, 会将lambda展开, 实际上是一个类, 重载```()```运算符.
```C++
int main()
{
    class __lambda_8_21
    {
        public:
        inline int operator()(const int & a) const
        {
        int b = a * a;
        return b;
        }

        using retType_8_21 = int (*)(const int &);
        inline operator retType_8_21 () const noexcept
        {
        return __invoke;
        };

        private:
        static inline int __invoke(const int & a)
        {
        int b = a * a;
        return b;
        }

        public:
        // inline /*constexpr */ __lambda_8_21(__lambda_8_21 &&) noexcept = default;

    };

    __lambda_8_21 lmd_func = __lambda_8_21(__lambda_8_21{});
    int lmd_ret = lmd_func.operator()(2);
    std::cout.operator<<(lmd_ret).operator<<(std::endl);
    return 1;
}
```
上面的```lmd_func```被展开成了类```__lambda_8_21```. 关注这条语句:
```C++
__lambda_8_21 lmd_func = __lambda_8_21(__lambda_8_21{});
```
使用了默认构造函数, 为什么要多此一举呢? 在这里直接使用:
```C++
__lambda_8_21 lmd_func = __lambda_8_21();
```
也是可以的. 但是, 如果情况稍微复杂一点, 就不能满足了. 比如我们使用捕获:
```
int main()
{
    auto init = 3;

    auto lmd_func = [init] (const int& a) {
        int b = a * a + init;
        return b;
    };

    auto lmd_ret = lmd_func(2);
    cout << lmd_ret << endl;

    return 1;
}
```
经过展开后, lambda表达式展开为:
```C++
class __lambda_10_21
{
public:
inline int operator()(const int & a) const
{
    int b = (a * a) + init;
    return b;
}

private:
int init;
public:
// inline /*constexpr */ __lambda_10_21(__lambda_10_21 &&) noexcept = default;
__lambda_10_21(int & _init)
: init{_init}
{}

};
```
捕获变量被构造成了展开类的成员变量, 并且实现了类的带参构造函数, lambda的调用语句被展开成了:
```
__lambda_10_21 lmd_func = __lambda_10_21(__lambda_10_21{init});
```
所以, 上述的值捕获, 在这里是通过构造函数传递给lambda表达式的.

> 以上展开式使用工具[cppinsights](https://cppinsights.io/)

### lambda编译期运算

> lambda表达式结果可以在编译期计算

lambda表达式是可以在编译期就计算出结果的.
```C++
auto lmd_func = [] (const int& a) {
    int b = a * a;
    return b;
};
```
上式展开得到以下的类, 我们看到了[constexpr](/202103/cpp-const-adconsexpr/)关键词, 这似乎意味lambda可以作为[constexpr](/202103/cpp-const-adconsexpr/)函数.
```C++
class __lambda_7_21
{
public:
    inline /*constexpr */ int operator()(const int & a) const
    {
        int b = a * a;
        return b;
    }

    using retType_7_21 = int (*)(const int &);
    inline /*constexpr */ operator retType_7_21 () const noexcept
    {
        return __invoke;
    };

    private:
    static inline int __invoke(const int & a)
    {
        int b = a * a;
        return b;
    }


    public:
    // /*constexpr */ __lambda_7_21() = default;
};
```
目前看来, C++11标准的编译器一般不会默认给lambda表达式添加上[constexpr](/202103/cpp-const-adconsexpr/)关键词.

但是C++17标准后, 给lambda表达式添加上了[constexpr](/202103/cpp-const-adconsexpr/)关键词. 所以在C++17编译条件下, 可以这样使用:
```C++
constexpr int dbl1 = lmd_func(3);
```
这时候就已经是编译期计算, 并且将值赋值给内存.

在C++11标准为了启动优化, 我们需要加上```-O2```参数(gcc编译器). 调用接口:
```C++
int dbl1 = lmd_func(3);
```
在汇编时编译器已经计算出结果, 并赋值给寄存器了(启动编译器优化后, 直接赋值给寄存器, 而不是内存).
```ASM
mov     esi, 9
```
