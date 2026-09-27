import yfinance as yf
dat = yf.Ticker("MSFT")
dat = yf.Ticker("MSFT")
dat.info
dat.calendar
dat.analyst_price_targets
dat.quarterly_income_stmt
dat.history(period='1mo')
dat.option_chain(dat.options[0]).calls



spy = yf.Ticker('SPY').funds_data
spy.description
spy.top_holdings

print(spy.top_holdings)