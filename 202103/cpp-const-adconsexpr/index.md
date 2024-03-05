# const和constexpr


> ```const```用来修饰只读.
>
> ```constexpr```用来修饰编译期可以确定的值.(编译期常量)

<!--more-->

## 只读的```const```修饰符

和一般认知一样, 用```const```修饰的变量不可被修改, 但是变量不可被修改并不代表变量值不可被修改;

按照[cppreference](https://en.cppreference.com/w/c/language/const)的解释, ```const```代表的是只读, 只读不代表不变, 看下面一段例子:
```C++
int main()
{
    int a = 1;
    const int& b = a;
    a = 2;
    cout << b;
}
```
编译通过, 输出b的结果是```2```;

上面代码中, 变量```b```被```const```修饰, 代表```b```是只读, 我们不能改变```b```, 但是可以改变```a```的值(这样```b```的值也被改变了), 尽管可以认为他们是同一个东西.

> 可以看成```const```只认名字不认内容.

## 编译期可以确定值的```constexpr```修饰符

```constexpr```是C++引入的关键词, 和```const```很像, 但是两者并不是完全替代关系.

```constexpr```修饰变量时修饰的时字面量/常量, 修饰函数时表示编译期有能力(可以)确定的值.

下面的例子是**不行的**:
```C++
int a = 1;
constexpr int b = a;
```
编译期会报错说```a```不是一个常量表达式:
```
the value of 'a' is not usable in a constant expression
```

下面的例子是**不行的**:
```C++
int a = 1;
const int& b = a;
constexpr int c = b;
```
编译期会报错说```b```不是一个常量表达式:
```
the value of 'b' is not usable in a constant expression
```

下面的例子是**可行的**:
```C++
const int a = 1;
constexpr int b = a;
```
对这个例子我的理解是, ```a```被修饰为一个只读变量, 并且```a```又是一个字面量, 所以```a```是一个常量.

但是这个例子是**不行的**:
```C++
const int a = 1;
const int &b = a;
constexpr int c = b;
```
编译器同样报错说```b```不是一个常量表达式. 我的理解是, 所有的值引用应该都不被当做常量. 看下面一个例子:
```C++
// const int a = 1;
int a = 1;
const int &b = a;       // 1
a = 2;
cout << b << endl;      // 2
```
不用const修饰```a```, 但是用const修饰```b&```, 表示```b```只能作为```a```的引用, 这时候我们是可以修改变量```a```的值并且反映在引用```b```上的.

### 用```constexpr```做编译期函数

```const```修饰的函数在运行时才可以返回函数值, 但是```constexpr```修饰的函数有能力在编译阶段就返回值.

比如以下函数:
```C++
constexpr int add(const int& a, const int& b)
{
    return a + b;
}
```

有能力在编译期计算并不代表一定在编译期计算, 调用上述```add```函数时, 只有在```a```和```b```是可以在编译期确定时, 函数才会在编译期返回计算结果, 否则依然时运行时返回.

```C++
int a = add(2, 3);  //编译期就可以确定结果
int b = add(a, 3);  //运行时确定结果
```
再看以下:
```C++
constexpr int a = add(2, 3);  //编译期就可以确定结果
int b = add(a, 3);            //编译期就可以确定结果
```
在我们看来, 上述代码可以说是一样的, 但是第二段代码给变量```a```加上了常量修饰符, 这样在```b```调用```add```时, ```a```就是一个字面量, 编译期可以确定的.

> 不要把编译期想的太智能, 如上, 如果你确定某个变量是常量, 那么应该直接告诉编译器, 而不要让编译器来猜.

不是所有函数都可以使用```constexpr```修饰.

在C++11的标准中, ```constexpr```修饰的函数应该只有一个```return```语句. 不同C++版本对此有不同的支持, [详见cppreference](https://en.cppreference.com/w/cpp/language/constexpr).

## 参考链接
- http://c.biancheng.net/view/7807.html
- https://en.cppreference.com/w/cpp/language/constexpr
- https://en.cppreference.com/w/c/language/const
