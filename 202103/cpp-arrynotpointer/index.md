# 数组名不是指针


## 问题

先来看一个问题:

<!--more-->


```C++
#include <iostream>

using namespace std;

#define ARRAY_SIZE(array) (sizeof((array)) / sizeof((array)[0]))

int main()
{
    int num_array[] = {1, 2, 3};
    int* num = num_array;

    cout << sizeof(num_array) << endl;
    cout << ARRAY_SIZE(num_array) << endl;

    return 1;
}
```

上面的代码输出是多少?


我们可以直接回答是```12```和```3```, 没问题.

但是稍微改动一下代码呢? 下面的代码输出是多少?

```C++
cout << sizeof(num) << endl;
cout << ARRAY_SIZE(num) << endl;
```

输出是:

```
8
2
```

看到答案后想想也是那么回事. 因为num是个指针所以```sizeof(num) = 8```, 没问题.

但是这个答案也揭示了一个问题:

> 数组和指针是有区别的.

## 编译器的解释

使用[cppinsights](https://cppinsights.io/)展开上面的代码, 看不到什么区别:
```C++
#include <iostream>

using namespace std;

#define ARRAY_SIZE(array) (sizeof((array)) / sizeof((array)[0]))

int main()
{
  int num_array[3] = {1, 2, 3};
  int* num = num_array;
  std::cout.operator<<(sizeof(num)).operator<<(std::endl);
  std::cout.operator<<((sizeof((num)) / sizeof((num)[0]))).operator<<(std::endl);
  return 1;
}
```

但是, **编译器已经提醒我们注意了, ```sizeof(num)```会返回指针的size, 而不是数组本身.**
```
warning: 'sizeof ((num))' will return the size of the pointer, not the array itself [-Wsizeof-pointer-div]
```

## 汇编的解释

先看下面代码段的汇编代码:
```C++
int num_array[] = {1, 2, 3};
int *num = num_array;
```
编译汇编后是:
```ASM
mov    DWORD PTR [rbp-0x14],0x1  # 写入1  int num_array[] = {1, 2, 3};
mov    DWORD PTR [rbp-0x10],0x2  # 写入2  int num_array[] = {1, 2, 3};
mov    DWORD PTR [rbp-0xc],0x3   # 写入3  int num_array[] = {1, 2, 3};
lea    rax,[rbp-0x14]            # 取数组首地址的有效地址  int *num = num_array;
mov    QWORD PTR [rbp-0x8],rax   # 有效地址赋值给num      int *num = num_array;
```
符合我们的认知, ```num```中存的是数组的首地址.

接下来添加一个函数:
```C++
void pTest(int *pnum)
{
    cout << pnum[0] << endl;
}
```

调用这个函数:
```C++
pTest(num);
```
汇编之后:
```ASM
mov    rax,QWORD PTR [rbp-0x8]
mov    rdi,rax
call   401182 <pTest(int*)>
```
可以理解, 是将指针指向的地址(指针的值)传递给函数参数, 有取值操作.

使用数组名调用这个函数:
```C++
pTest(num_array);
```
汇编之后:
```ASM
lea    rax,[rbp-0x14]
mov    rdi,rax
call   401182 <pTest(int*)>
```
和使用指针有区别, **使用数组名传递的是地址, 没有取值操作**.

到此结合```int *num = num_array;```的汇编, 我们可以知道**数组名代表的是地址**(!!!不是指针!!!)

## 数组名是个右值

如果清楚理解了上文的结论"**数组名代表的是地址**", 就能清楚的理解"**数组名是个右值**"这一结论.

我们使用代码来增强一下印象:
```C++
num_array++;
```
数组名作为左值是不行的! 上一段代码会报错:
```
<source>: In function 'int main()':
<source>:23:5: error: lvalue required as increment operand
   23 |     num_array++;
      |     ^~~~~~~~~
Execution build compiler returned: 1
```

## 结论

教科书中应该是提过这个观点: "数组名代表的是数组首地址", 但是很少强调数组名和指针的区别.

综上所述, 我们强调数组和指针的区别, 并且有以下结论:

1. 数组名是地址, **不是指针, 而是地址**;
2. 数组名是右值;
3. 指针不是地址, 指针的值才是地址.
