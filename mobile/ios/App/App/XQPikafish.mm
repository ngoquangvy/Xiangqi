#import "XQPikafish.h"
#include "PikafishSession.h"

@implementation XQPikafish {
    std::unique_ptr<PikafishSession> _session;
}
- (instancetype)init {
    if ((self = [super init])) {
        __weak XQPikafish *owner = self;
        _session = std::make_unique<PikafishSession>([owner](const std::string& request, const std::string& line) {
            @autoreleasepool {
                XQPikafish *current = owner;
                if (current.output) current.output([NSString stringWithUTF8String:request.c_str()],
                                                  [NSString stringWithUTF8String:line.c_str()]);
            }
        });
    }
    return self;
}
- (NSString *)analyze:(NSDictionary<NSString *, id> *)request {
    try {
        _session->analyze([request[@"id"] UTF8String], [request[@"initialFen"] UTF8String],
            [request[@"moves"] UTF8String], [request[@"network"] UTF8String],
            { [request[@"threads"] intValue], [request[@"hash"] intValue],
              [request[@"depth"] intValue], [request[@"milliseconds"] intValue] });
        return nil;
    } catch (const std::exception& error) {
        return [NSString stringWithUTF8String:error.what()];
    }
}
- (void)cancel { _session->cancel(); }
- (void)releaseEngine { _session->release(); }
- (BOOL)searching { return _session->searching(); }
@end
