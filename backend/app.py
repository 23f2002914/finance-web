"""Flask app factory and error handlers."""
from flask import Flask, jsonify, request
from flask_cors import CORS

def create_app():
    """Create and configure Flask app."""
    app = Flask(__name__)
    CORS(app)

    # Error handlers
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'error': 'Not found'}), 404

    @app.errorhandler(400)
    def bad_request(error):
        return jsonify({'error': str(error)}), 400

    @app.errorhandler(Exception)
    def handle_error(error):
        print(f"Unhandled error: {error}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Internal server error'}), 500

    # Register blueprints
    from backend.blueprints import accounts, account_openings, debts, income, expenses
    from backend.blueprints import subscriptions, budgets, transfers, dashboard, report
    from backend.blueprints import import_export, changelog

    app.register_blueprint(accounts.bp)
    app.register_blueprint(account_openings.bp)
    app.register_blueprint(debts.bp)
    app.register_blueprint(income.bp)
    app.register_blueprint(expenses.bp)
    app.register_blueprint(subscriptions.bp)
    app.register_blueprint(budgets.bp)
    app.register_blueprint(transfers.bp)
    app.register_blueprint(dashboard.bp)
    app.register_blueprint(report.bp)
    app.register_blueprint(import_export.bp)
    app.register_blueprint(changelog.bp)

    return app

if __name__ == '__main__':
    from backend.config import DEBUG, PORT
    app = create_app()
    app.run(debug=DEBUG, port=PORT, host='0.0.0.0')
