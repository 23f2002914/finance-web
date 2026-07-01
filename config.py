import os

_here = os.path.dirname(os.path.abspath(__file__))

DB_PATH    = os.environ.get('FINANCE_DB',      os.path.join(_here, 'finance.db'))
SECRET_KEY = os.environ.get('SECRET_KEY',      'dev-secret-change-me-in-production')
DEBUG      = os.environ.get('DEBUG',           'true').lower() == 'true'
PASSWORD   = os.environ.get('FINANCE_PASSWORD','')   # empty = no auth required
PORT       = int(os.environ.get('PORT',        '5000'))
