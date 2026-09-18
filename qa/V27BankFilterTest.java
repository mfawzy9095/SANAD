package com.sanad.full;
public final class V27BankFilterTest {
  private static void ok(boolean v,String m){ if(!v) throw new AssertionError(m); }
  public static void main(String[] args){
    ok(BankMessageFilter.isFinancial("Your card AED 125.50 was debited at CARREFOUR"),"english debit");
    ok(BankMessageFilter.isFinancial("تم خصم مبلغ 42.50 درهم من بطاقتك"),"arabic debit");
    ok(!BankMessageFilter.isFinancial("Your minimum due is AED 500.00. Please pay before 25 Sep"),"minimum due false positive");
    ok(!BankMessageFilter.isFinancial("Your available balance is AED 5000"),"balance false positive");
    ok(!BankMessageFilter.isFinancial("OTP 123456 for payment AED 25"),"otp false positive");
    System.out.println("V2.7 BankMessageFilter QA passed");
  }
}