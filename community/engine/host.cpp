#include "hermes/hermes.h"
#include <fstream>
#include <iostream>
#include <sstream>
using namespace facebook;
int main(int argc, char** argv) {
  auto rt = facebook::hermes::makeHermesRuntime();
  auto& r = *rt;
  r.global().setProperty(r,"print",jsi::Function::createFromHostFunction(r,jsi::PropNameID::forAscii(r,"print"),1,
    [](jsi::Runtime& r,const jsi::Value&,const jsi::Value* args,size_t n)->jsi::Value {
      for(size_t i=0;i<n;i++){if(i)std::cout<<" ";std::cout<<args[i].toString(r).utf8(r);}std::cout<<std::endl;return jsi::Value::undefined();
    }));
  try {
    for(int i=1;i<argc;i++) {
      std::ifstream f(argv[i],std::ios::binary);if(!f)throw std::runtime_error("Missing input file");
      std::ostringstream s;s<<f.rdbuf();
      r.evaluateJavaScript(std::make_shared<jsi::StringBuffer>(s.str()),argv[i]);
      r.drainMicrotasks();
    }
    std::string line;
    while(std::getline(std::cin,line)) {
      try {
        auto handler=r.global().getPropertyAsFunction(r,"__handleLine");
        handler.call(r,jsi::String::createFromUtf8(r,line));
        r.drainMicrotasks();
      } catch(const std::exception& e){std::cerr<<e.what()<<std::endl;}
    }
  }catch(const std::exception& e){std::cerr<<e.what()<<std::endl;return 1;}
}
