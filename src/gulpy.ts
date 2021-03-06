/* Copyright 2018 Mozilla Foundation
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

export type PromiseMaker = () => Promise<any>;

class Task {
  name: string;
  dependencies: Task [];
  promiseMaker: PromiseMaker;

  constructor(name: string, dependencies: Task [], promiseMaker: PromiseMaker) {
    this.name = name;
    this.dependencies = dependencies;
    this.promiseMaker = promiseMaker;
  }
}

class TaskInstance {
  task: Task;
  promise: Promise<any>;
  constructor(task: Task) {
    this.task = task;
    this.promise = null;
  }
  makePromise(): Promise<any> {
    if (this.promise) {
      return this.promise;
    }
    return this.promise = this.task.promiseMaker();
  }
}

class GulpySession {
  private gulpy: Gulpy;
  private tasks: Map<Task, TaskInstance> = new Map();
  constructor(gulpy: Gulpy) {
    this.gulpy = gulpy;
  }
  ensureInstance(task: Task): TaskInstance {
    let instance = this.tasks.get(task);
    if (instance) {
      return instance;
    }
    instance = new TaskInstance(task);
    this.tasks.set(task, instance);
    return instance;
  }
  async runInstance(instance: TaskInstance): Promise<any> {
    const dependencies = instance.task.dependencies.map(x => this.ensureInstance(x));
    await Promise.all(dependencies.map(x => this.runInstance(x)));
    return instance.makePromise();
  }
  async run(task: Task): Promise<any> {
    return this.runInstance(this.ensureInstance(task));
  }
}
export class Gulpy {
  private tasks: { [name: string]: Task } = {};
  private session: GulpySession;

  task(name: string, fn: Function): void;
  task(name: string, dependencies: string[], fn?: Function): void;
  task(name: string, a: string [] | Function, b?: Function): void {
    let dependencies: string [] = [];
    let fn: Function = null;
    if (arguments.length === 3) {
      dependencies = a as string[];
      fn = b;
    } else if (arguments.length === 2) {
      if (Array.isArray(a)) {
        dependencies = a as string[];
        fn = b || ((callback: Function) => { callback(); });
      } else {
        fn = a as PromiseMaker;
      }
    }
    const promiseMaker = (() => {
      if (fn.length === 0) {
        return new Promise((resolve, reject) => {
          try {
            resolve(fn());
          } catch (e) {
            reject(e);
          }
        });
      }
      return new Promise((resolve, reject) => {
        fn(function(error: any) {
          if (error) {
            reject(error);
          }
          resolve();
        });
      });
    }) as PromiseMaker;
    this.tasks[name] = new Task(name, dependencies.map(x => this.tasks[x]), promiseMaker);
  }
  series(tasks: string[]): PromiseMaker {
    return null;
  }
  parallel(tasks: string[]): PromiseMaker {
    return null;
  }
  hasTask(name: string) {
    return name in this.tasks;
  }
  async run(name: string) {
    const session = new GulpySession(this);
    await session.run(this.tasks[name]);
  }
}
