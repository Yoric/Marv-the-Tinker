Marv the Tinker
===============

JavaScript is a very nice language: flexible, available on any device,
including servers, gifted with the most powerful UI toolkits
and reasonably fast.

However, the dynamism that makes all of this possible also makes
development of large applications somewhat nightmarish. Errors
generally pop up long after application has started - or been deployed
- and often in parts of the code distant from their sources.

So, what can we do to improve the situation?

Say, here is an idea. Perhaps we can write a compiler that generates
JavaScript from JavaScript, and perhaps we can use that compiler to:

- immediate detection of errors during compilation;
- early detection of errors during execution;
- detect some vulnerabilities;
- generate code otherwise too unreadable/error-prone to be
   written manually;
- take the opportunity to optimize the code for size, speed, etc.

We call that compiler Marv the Tinker.

For the moment, it does very little. Consider it an early experiment
on one of the many directions in which JavaScript can be pushed. An
experiment, also, on how to do better than Google Dart, without having
to abandon JavaScript.

By the way, Marv is implemented in JavaScript. So, if you want to run it,
say, in your JavaScript server, or in your browser, this is possible, too.

What does it do?
----------------

For the moment, very little:

- Marv checks your syntax;
- Marv resolves your variable definitions;
- Marv informs you if your variable definitions collide;
- Marv informs you if you are using undefined identifiers.


How do I use it?
----------------

For the moment, Marv is not considered usable. If you want to try it, though,
execute

   ./marvc source_file.js

It will produce the following files:

- out.js (generated JavaScript);
- out.log (warnings and errors detected);
- debug.log (random stuff).


What is next?
-------------

Marv is far from complete. The next features that we intend to add are:
- Cleanup;
- Handling a larger subset of JavaScript;
- Instrumenting code for early type-error detection;
- Bootstrapping.

Once this is done, we will proceed with
- Instrumenting code for pre/post conditions error detection;
- Instrumenting code for detection of broken invariants;
- Elements of static type-checking with inference.
