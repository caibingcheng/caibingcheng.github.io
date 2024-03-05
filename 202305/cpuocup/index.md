# 设置CPU使用率的工具-cpuocup


`cpuocup`是一款设置CPU使用率的工具, 可以设置若干线程的CPU使用率, 可以将线程绑定到对应的CPU核心, 也可以设置线程的执行优先级(需要sudo权限). 在一些需要低效CPU的测试场合, 该工具可能帮得上忙.

<!--more-->



- 项目地址: [caibingcheng/cpuocup (github.com)](https://github.com/caibingcheng/cpuocup)



> 已经很久没有更新. 在二月份的时候经历了裁员, 三月份开始找工作, 入职了一家新公司, 每个工作日都需要花费3个小时的通勤时间, 有点累... 停更了很久, 其实在这期间也写了一些内容, 但是因为工作的原因没有及时更新和润色, 并且有些玩意儿做的不是很好, 还需要改进, 所以并没有贴出来. 现在已经工作一个多月, 对工作和通勤都适应起来了, 所以, 博客也要继续搞起来. 期望可以保持原来的更新速度, 以及学习和探索一些更有意思的问题.



没有什么十分明确的契机, 可能因为最近用上了Copilot, 工作上又做了一些性能测试相关的内容, 便想到了做这样一个和性能有些相关的东西.



详细用法可以见仓库的README, 简单用法如下:

```
cpuocup 0.5
#set thread 0 to 50% usage
cpuocup 1,0.5
#set thread 1 to 50% usage, and bind to cpu 1
```



设计上, `cpuocup`最多可以启动cpu核心数个线程, 以确保可以让每个核心分配一个工作线程. 

如以上`cpuocup 0.5`指令, 会启动一个线程, 将线程的cpu占用率设置为50%附近, 但是不会绑定到某个核心, 因此实际情况上, 可能会又多个核心分担这个线程的资源消耗, 从而在使用top指令观察的时候, 可能看不到某个核心占用为50%的情况.

又如`cpuocup 1,0.5` 指令, 会启动一个线程, 将线程的cpu占用率设置为50%附近, 并且将该线程绑定到cpu 1上, 因此在使用top指令观察时, 是可以观察到cpu 1的占用率接近50%的. 当然如果有其他线程也在消耗这个核心, 那么其占用率可能是超过50%的.



### 体验Copilot

关于`cpuocup`这个工具, 其实**我的核心是体验Copilot**. 通过Copilot, 可以减少在浏览器和编辑器之间的切换次数. 还在学校的时候, 我试用过`tabnine`, `tabnine`更像是上下文提示(现在不知道是什么程度了), Copilot远不止如此.

比如, 当需要写cpu绑核相关代码的时候, 我可能不知道对应API是什么, 以及如何使用, 那么我可以:

```C++
// bind thread to cpu
```

只需要相关的注释, Copilot就有可能帮助我完成相关的代码. 比如, 它可能为我生成:

```c++
cpu_set_t set;
CPU_ZERO(&set);
CPU_SET(arg.cpu_id, &set);
pthread_setaffinity_np(threads.back().native_handle(), sizeof(cpu_set_t), &set);
```

在这之后, 我先验证设置是否成功, 也只需要注释:

```
// check if cpu affinity set success
```

那么Copilot就可以帮助生成验证cpu affinity设置时候成功的代码, 比如:

```
cpu_set_t get;
CPU_ZERO(&get);
pthread_getaffinity_np(threads.back().native_handle(), sizeof(cpu_set_t), &get);
check(CPU_ISSET(arg.cpu_id, &get), "Set cpu affinity failed");
```

注意到, 它还自己动调用了我在这份文件中写的check接口, 并且帮助生成了错误提示代码.



又比如, 我想为每个command绑定函数的时候, 有这样一段代码:

```c++
std::unordered_map<char, cmd_job_t> g_cmd_jobs = {
    {'f', [](std::vector<thread_args>& args, thread_args& arg) {
        for (auto i = 0; i < args.size(); ++i) {
            args[i] = arg;
        }
    }},
    {'F', [](std::vector<thread_args>& args, thread_args& arg) {
        for (auto i = 0; i < args.size(); ++i) {
            args[i] = arg;
            args[i].cpu_id = i;
        }
    }},
    {'r', [](std::vector<thread_args>& args, thread_args& arg) {
        for (auto i = 0; i < args.size(); ++i) {
            if (!args[i].specific) {
                args[i] = arg;
            }
        }
    }},
    {'R', [](std::vector<thread_args>& args, thread_args& arg) {
        for (auto i = 0; i < args.size(); ++i) {
            if (!args[i].specific) {
                args[i] = arg;
                args[i].cpu_id = i;
            }
        }
    }},
};
```

这是Copilot帮助生成的. 在这之前, 我在`parse_args`函数内部实现了相关的代码, 在整理代码的时候我想改成map的形式, 因此, 当我输入`std::unordered_map`这几个字符的时候, Copilot就以及帮助我生成了剩下的代码, 我几乎不需要再去修改, 只需要将原来的代码删除即可.

另外, 在忘记`#include <unordered_map>`时, 光标移动到include区域, Copilot也自动补全了缺少的部分. 



再比如, `helper_str`也是Copilot生成的, 可以看看它的内容:

```c++
std::string g_helper_str =
// unix style helper
"\033[1mNAME\033[0m\n"
"    cpuocup - set cpu userspace usage rate\n"
"\033[1mVERSION\033[0m\n"
"    " + std::string(VERSION_STRING) + "\n"
"\033[1mUSAGE\033[0m\n"
// can set [rate] [cpu_id,rate] [cpu_id,priority,rate] [cmd,rate] [cmd,priority,rate]
"    \033[1mcpuocup\033[0m [\033[4mrate\033[0m] [\033[4mcpu_id\033[0m,\033[4mrate\033[0m] [\033[4mcpu_id\033[0m,\033[4mpriority\033[0m,\033[4mrate\033[0m] [\033[4mcmd\033[0m,\033[4mrate\033[0m] [\033[4mcmd\033[0m,\033[4mpriority\033[0m,\033[4mrate\033[0m] ...\n"
"\033[1mDESCRIPTION\033[0m\n"
"    This program is used to set cpu rate. Max " + std::to_string(g_hardware_threads) + " threads are supported at the device.\n"
"    \033[1mrate\033[0m: thread rate, 0.0 <= rate <= 1.0\n"
"    \033[1mcpu_id\033[0m: cpu id, -1 means thread not bind any cpu, range: [-1, " + std::to_string(g_hardware_threads-1) + "]\n"
"    \033[1mpriority\033[0m: thread priority, range: [0, 99]\n"
// cmd support: f, F, r, R
"    \033[1mcmd\033[0m: f, r, F, R\n"
"        f: set to all threads\n"
"        r: set to all threads which is not specific\n"
"        F: set to all threads, and bind to corresponding cpu\n"
"        R: set to all threads which is not specific, and bind to corresponding cpu\n"
"\033[1mEXAMPLE\033[0m\n"
// give 5 classic examples of each usage, and explain the meaning of each example
"    \033[1mcpuocup\033[0m 0.5 0.9\n"
"        set thread 0 to 50% usage, and thread 1 to 90% usage\n"
"    \033[1mcpuocup\033[0m 1,0.5\n"
"        set thread 1 to 50% usage, and bind to cpu 1\n"
"    \033[1mcpuocup\033[0m 1,20,0.5\n"
"        set thread 1 to 50% usage, and bind to cpu 1, and set thread priority to 20\n"
"    \033[1mcpuocup\033[0m f,0.5\n"
"        set all threads to 50% usage\n"
"    \033[1mcpuocup\033[0m 1,20,0.5, r,40,0.9\n"
"        set thread 1 to 50% usage, and bind to cpu 1, and set thread priority to 20\n"
"        set all threads which is not specific to 90% usage, and set thread priority to 40, and bind to corresponding cpus\n"
"\033[1mAUTHOR\033[0m\n"
"    Written by \033[1mcaibingcheng\033[0m.\n"
"\033[1mREPORTING BUGS\033[0m\n"
"    Report bugs to \033[1mjack_cbc@163.com\033[0m.\n"
"\033[1mCOPYRIGHT\033[0m\n"
"    This is free software: you are free to change and redistribute it.\n"
"    There is NO WARRANTY, to the extent permitted by law.\n"
;
```

当然, 这已经是迭代了好几个版本之后的内容, 在Copilot描述的`cpuocup`用法上, 稍微有点不准, 但是需要修改的地方不多. 在生成`helper_str`的过程中, 我同样只需要填写注释, 比如开头填写:

```C++
// unix style helper
```

那么, 它会帮助我生成UNIX风格的helper信息. 在用法描述上, Copilot有缺失项, 那么我同样用注释告知其正确用法:

```c++
// can set [rate] [cpu_id,rate] [cpu_id,priority,rate] [cmd,rate] [cmd,priority,rate]
```



### 小结

以上.

项目中, 有注释的部分基本都是Copilot协助完成的, 这些部分, 我基本只需要输出注释, 有些注释因为在早期开发变动较大, 就删除了. 项目中的一些重复性较大的代码, 也是由Copilot协助完成.

对此, 我最大的感触是, 对于这些独立的小项目, 我只需要关心整体设计, 至于代码如何实现, 接口如何调用我已经不需要关心了, 甚至也不需要浏览器. 不过对于比较大的项目, 目录结构比较复杂, Copilot就显得没有那么"机智"了.

(这篇文章有点水~除去代码时间, 文章内容可能只准备两个小时. 不过博客可算更新了, 也算是又步入正轨了吧, 用输出来促进我的输入! 前段时间还做了心率检测相关的东西, 以及调查了文件buffer指针相关的内容, 期望能尽快有输出. 还有, Copilot体验还是非常好的!)

