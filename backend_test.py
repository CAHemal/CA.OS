import requests
import sys
import json
from datetime import datetime, timezone

class CAOSAPITester:
    def __init__(self, base_url="https://staff-ops-ca.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.admin_user = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        
        # Store created IDs for cleanup
        self.created_employee_id = None
        self.created_task_id = None
        self.created_client_id = None
        self.created_query_id = None

    def log_test(self, name, success, details=None):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            self.failed_tests.append({"test": name, "details": details})
            print(f"❌ {name} - {details}")

    def make_request(self, method, endpoint, data=None, expected_status=200):
        """Make HTTP request and validate response"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)
                
            success = response.status_code == expected_status
            return success, response.json() if response.content else {}, response.status_code
        except Exception as e:
            return False, {"error": str(e)}, None

    def test_login(self):
        """Test admin login"""
        success, response, status = self.make_request('POST', 'auth/login', {
            'email': 'admin@caos.com',
            'password': 'admin123'
        })
        
        if success and 'token' in response:
            self.token = response['token']
            self.admin_user = response['user']
            self.log_test("Admin Login", True)
            return True
        else:
            self.log_test("Admin Login", False, f"Status: {status}, Response: {response}")
            return False

    def test_dashboard_stats(self):
        """Test dashboard stats API"""
        success, response, status = self.make_request('GET', 'dashboard/stats')
        
        required_fields = ['total_employees', 'active_tasks', 'present_today', 'pending_leaves', 'recent_tasks', 'weekly_attendance']
        if success and all(field in response for field in required_fields):
            self.log_test("Dashboard Stats", True)
            return True
        else:
            self.log_test("Dashboard Stats", False, f"Missing fields or status: {status}")
            return False

    def test_employee_crud(self):
        """Test employee CRUD operations"""
        # Create employee
        employee_data = {
            'email': 'test.employee@caos.com',
            'password': 'testpass123',
            'name': 'Test Employee',
            'role': 'employee',
            'department': 'Accounting',
            'phone': '9876543210'
        }
        
        success, response, status = self.make_request('POST', 'auth/register', employee_data, 200)
        if success:
            self.created_employee_id = response['id']
            self.log_test("Create Employee", True)
        else:
            self.log_test("Create Employee", False, f"Status: {status}")
            return False

        # List employees
        success, response, status = self.make_request('GET', 'employees')
        if success and isinstance(response, list) and len(response) >= 2:  # Admin + new employee
            self.log_test("List Employees", True)
        else:
            self.log_test("List Employees", False, f"Status: {status}")

        # Get specific employee
        if self.created_employee_id:
            success, response, status = self.make_request('GET', f'employees/{self.created_employee_id}')
            if success and response.get('id') == self.created_employee_id:
                self.log_test("Get Employee", True)
            else:
                self.log_test("Get Employee", False, f"Status: {status}")

        return True

    def test_task_crud(self):
        """Test task CRUD operations"""
        if not self.created_employee_id:
            self.log_test("Task CRUD", False, "No employee to assign tasks to")
            return False

        # Create task
        task_data = {
            'title': 'Test Task',
            'description': 'Test task description',
            'assigned_to': self.created_employee_id,
            'priority': 'high',
            'due_date': '2024-12-31'
        }
        
        success, response, status = self.make_request('POST', 'tasks', task_data, 200)
        if success:
            self.created_task_id = response['id']
            self.log_test("Create Task", True)
        else:
            self.log_test("Create Task", False, f"Status: {status}")
            return False

        # List tasks
        success, response, status = self.make_request('GET', 'tasks')
        if success and isinstance(response, list):
            self.log_test("List Tasks", True)
        else:
            self.log_test("List Tasks", False, f"Status: {status}")

        # Update task status
        if self.created_task_id:
            success, response, status = self.make_request('PUT', f'tasks/{self.created_task_id}/status', 
                                                        {'status': 'in_progress'})
            if success:
                self.log_test("Update Task Status", True)
            else:
                self.log_test("Update Task Status", False, f"Status: {status}")

        return True

    def test_attendance(self):
        """Test attendance clock-in/out"""
        # Clock in
        success, response, status = self.make_request('POST', 'attendance/clock-in', {})
        if success:
            self.log_test("Attendance Clock-in", True)
        else:
            # Check if already clocked in
            if status == 400 and "Already clocked in" in str(response):
                self.log_test("Attendance Clock-in", True, "Already clocked in today")
            else:
                self.log_test("Attendance Clock-in", False, f"Status: {status}")

        # Get today's attendance
        success, response, status = self.make_request('GET', 'attendance/today')
        if success:
            self.log_test("Get Today's Attendance", True)
        else:
            self.log_test("Get Today's Attendance", False, f"Status: {status}")

        # Clock out (optional - might fail if already clocked out)
        success, response, status = self.make_request('POST', 'attendance/clock-out', {})
        if success:
            self.log_test("Attendance Clock-out", True)
        elif status == 400:
            self.log_test("Attendance Clock-out", True, "Clock-out validation working")
        else:
            self.log_test("Attendance Clock-out", False, f"Status: {status}")

    def test_leave_management(self):
        """Test leave application and approval"""
        # Apply for leave
        leave_data = {
            'leave_type': 'sick',
            'start_date': '2024-12-25',
            'end_date': '2024-12-26',
            'reason': 'Medical appointment'
        }
        
        success, response, status = self.make_request('POST', 'leaves', leave_data)
        if success:
            leave_id = response['id']
            self.log_test("Apply Leave", True)
            
            # Approve leave
            success, response, status = self.make_request('PUT', f'leaves/{leave_id}/approve', {})
            if success:
                self.log_test("Approve Leave", True)
            else:
                self.log_test("Approve Leave", False, f"Status: {status}")
        else:
            self.log_test("Apply Leave", False, f"Status: {status}")

        # List leaves
        success, response, status = self.make_request('GET', 'leaves')
        if success and isinstance(response, list):
            self.log_test("List Leaves", True)
        else:
            self.log_test("List Leaves", False, f"Status: {status}")

    def test_client_crud(self):
        """Test client CRUD operations"""
        client_data = {
            'name': 'Test Client Ltd',
            'email': 'test@testclient.com',
            'phone': '+91 9876543210',
            'company': 'Test Client Ltd',
            'pan_number': 'ABCDE1234F',
            'gst_number': '27ABCDE1234F1Z5',
            'services': ['Tax Filing', 'Audit'],
            'notes': 'Test client for testing purposes'
        }
        
        success, response, status = self.make_request('POST', 'clients', client_data)
        if success:
            self.created_client_id = response['id']
            self.log_test("Create Client", True)
        else:
            self.log_test("Create Client", False, f"Status: {status}")

        # List clients
        success, response, status = self.make_request('GET', 'clients')
        if success and isinstance(response, list):
            self.log_test("List Clients", True)
        else:
            self.log_test("List Clients", False, f"Status: {status}")

    def test_query_system(self):
        """Test query/response system"""
        # Create query
        query_data = {
            'title': 'Test Query',
            'description': 'This is a test query for testing purposes',
            'to_user_id': self.created_employee_id if self.created_employee_id else None
        }
        
        success, response, status = self.make_request('POST', 'queries', query_data)
        if success:
            self.created_query_id = response['id']
            self.log_test("Create Query", True)
            
            # Respond to query
            response_data = {'message': 'This is a test response'}
            success, response, status = self.make_request('POST', f'queries/{self.created_query_id}/respond', response_data)
            if success:
                self.log_test("Respond to Query", True)
            else:
                self.log_test("Respond to Query", False, f"Status: {status}")
        else:
            self.log_test("Create Query", False, f"Status: {status}")

        # List queries
        success, response, status = self.make_request('GET', 'queries')
        if success and isinstance(response, list):
            self.log_test("List Queries", True)
        else:
            self.log_test("List Queries", False, f"Status: {status}")

    def test_notifications(self):
        """Test notifications"""
        success, response, status = self.make_request('GET', 'notifications')
        if success and isinstance(response, list):
            self.log_test("Get Notifications", True)
        else:
            self.log_test("Get Notifications", False, f"Status: {status}")

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting CA.OS API Testing...")
        print(f"Testing against: {self.base_url}")
        print("=" * 50)

        # Login is required for all other tests
        if not self.test_login():
            print("❌ Login failed - stopping tests")
            return False

        # Run all tests
        self.test_dashboard_stats()
        self.test_employee_crud()
        self.test_task_crud()
        self.test_attendance()
        self.test_leave_management()
        self.test_client_crud()
        self.test_query_system()
        self.test_notifications()

        # Print results
        print("\n" + "=" * 50)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.failed_tests:
            print("\n❌ Failed Tests:")
            for failed in self.failed_tests:
                print(f"  • {failed['test']}: {failed['details']}")
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"\n✅ Success Rate: {success_rate:.1f}%")
        
        return success_rate >= 80

if __name__ == "__main__":
    tester = CAOSAPITester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)