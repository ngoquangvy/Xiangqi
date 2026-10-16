#import <Foundation/Foundation.h>
NS_ASSUME_NONNULL_BEGIN
@interface XQPikafish : NSObject
@property(nonatomic, copy, nullable) void (^output)(NSString *requestID, NSString *line);
- (nullable NSString *)analyze:(NSDictionary<NSString *, id> *)request;
- (void)cancel;
- (void)releaseEngine;
- (BOOL)searching;
@end
NS_ASSUME_NONNULL_END
