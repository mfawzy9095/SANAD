import com.sanad.full.BankSmsParser;
import java.time.*;
public class TestBankSmsParser {
  static void ok(String n, boolean v){ if(!v) throw new RuntimeException("FAIL: "+n); System.out.println("PASS: "+n); }
  static long ms(int y,int m,int d,int h,int min){ return LocalDateTime.of(y,m,d,h,min).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli(); }
  public static void main(String[] args){
    long ref=ms(2026,9,19,10,0);
    BankSmsParser.Result a=BankSmsParser.parse("Your card ending 1234 was used for AED 47.50 at CARREFOUR on 18-Sep-26 21:15",ref);
    ok("purchase parse",a!=null&&Math.abs(a.amount-47.5)<.001&&"AED".equals(a.currency)&&"expense".equals(a.type));
    ok("message date",a.transactionAt>0&&Instant.ofEpochMilli(a.transactionAt).atZone(ZoneId.systemDefault()).getDayOfMonth()==18);
    BankSmsParser.Result b=BankSmsParser.parse("AED 125.00 was debited from your account on 18/09/2026 13:10. Available balance AED 5,240.10",ref);
    ok("debit chooses transaction not balance",b!=null&&Math.abs(b.amount-125)<.001);
    BankSmsParser.Result c=BankSmsParser.parse("تم خصم مبلغ 42.50 درهم من بطاقتكم ****1234 لدى كارفور بتاريخ 18/09/2026 الساعة 20:05. الرصيد المتاح 5000 درهم",ref);
    ok("arabic amount",c!=null&&Math.abs(c.amount-42.5)<.001&&"AED".equals(c.currency));
    ok("minimum due rejected",BankSmsParser.parse("Your minimum amount due is AED 350.00. Payment due 25/09/2026",ref)==null);
    ok("otp rejected",BankSmsParser.parse("OTP 123456 for transaction AED 60 at STORE",ref)==null);
    BankSmsParser.Result f=BankSmsParser.parse("You have received AED 250.00 in your wallet on 18-Sep-26",ref);
    ok("income",f!=null&&"income".equals(f.type)&&Math.abs(f.amount-250)<.001);
    BankSmsParser.Result g=BankSmsParser.parse("Purchase AED 19.75 at CAFE 18/09 08:30",ref);
    ok("year inference",g!=null&&g.transactionAt>0&&Instant.ofEpochMilli(g.transactionAt).atZone(ZoneId.systemDefault()).getYear()==2026);
  }
}
