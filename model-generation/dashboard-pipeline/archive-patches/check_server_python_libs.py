try:
    import psycopg2  # noqa: F401
    print("psycopg2 yes")
except Exception as error:
    print("psycopg2 no", error)

try:
    import pandas  # noqa: F401
    print("pandas yes")
except Exception as error:
    print("pandas no", error)
