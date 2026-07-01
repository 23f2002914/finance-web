"""Changelog/audit log API endpoints."""
from flask import Blueprint, request, jsonify
from backend.db import get_client

bp = Blueprint('changelog', __name__, url_prefix='/api')

@bp.route('/changelog', methods=['GET'])
def list_changelog():
    """GET /api/changelog - list recent changes (audit log)."""
    supabase = get_client()
    limit = request.args.get('limit', 200, type=int)

    try:
        changes = supabase.table('_changelog').select('*').order('ts', desc=True).limit(limit).execute()
        return jsonify(changes.data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
